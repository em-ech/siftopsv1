import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ShopifyService } from '../shopify/shopify.service';
import { AuthService } from '../auth/auth.service';
import { EncryptionService } from '../encryption/encryption.service';
import { EmbeddingsService, EMBEDDINGS_SERVICE } from '../embeddings/embeddings.interface';
import { SyncStatus } from '@prisma/client';

interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: string;
  metafields?: {
    edges: Array<{
      node: {
        namespace: string;
        key: string;
        value: string;
      };
    }>;
  };
  collections?: {
    edges: Array<{
      node: {
        title: string;
      };
    }>;
  };
  variants?: {
    edges: Array<{
      node: {
        id: string;
        title?: string;
        price: string;
        compareAtPrice?: string;
        availableForSale: boolean;
        inventoryQuantity?: number;
        selectedOptions?: Array<{
          name: string;
          value: string;
        }>;
        image?: {
          url: string;
        };
      };
    }>;
  };
}

interface ShopifyVariant {
  id: string;
  title?: string;
  price: string;
  compareAtPrice?: string;
  availableForSale: boolean;
  inventoryQuantity?: number;
  selectedOptions?: Array<{
    name: string;
    value: string;
  }>;
  image?: {
    url: string;
  };
  __parentId?: string;
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopify: ShopifyService,
    private readonly auth: AuthService,
    private readonly encryption: EncryptionService,
    @Inject(EMBEDDINGS_SERVICE) private readonly embeddings: EmbeddingsService,
  ) {}

  // Process product create/update webhook
  async processProductWebhook(
    shopDomain: string,
    webhookId: string,
    product: ShopifyProduct,
  ): Promise<void> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      this.logger.warn(`Shop not found: ${shopDomain}`);
      return;
    }

    // Log webhook for debugging
    await this.prisma.webhookLog.create({
      data: {
        shopDomain,
        topic: 'products/create_or_update',
        webhookId,
        payload: product as any,
      },
    });

    // Skip if product is not active
    if (product.status && product.status !== 'ACTIVE') {
      await this.deleteProductVariants(shop.id, product.id);
      return;
    }

    // Process each variant
    const collections = product.collections?.edges.map(e => e.node.title) || [];
    const metafields = this.extractMetafields(product.metafields);
    const tags = product.tags || [];

    for (const variantEdge of product.variants?.edges || []) {
      const variant = variantEdge.node;
      await this.upsertVariant(shop.id, product, variant, collections, metafields, tags);
    }

    // Mark webhook as processed
    await this.prisma.webhookLog.updateMany({
      where: { webhookId },
      data: { processed: true },
    });
  }

  // Process product delete webhook
  async processProductDeleteWebhook(
    shopDomain: string,
    webhookId: string,
    productId: string,
  ): Promise<void> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      return;
    }

    await this.prisma.webhookLog.create({
      data: {
        shopDomain,
        topic: 'products/delete',
        webhookId,
        payload: { productId },
      },
    });

    await this.deleteProductVariants(shop.id, productId);

    await this.prisma.webhookLog.updateMany({
      where: { webhookId },
      data: { processed: true },
    });
  }

  // Process inventory level update webhook
  async processInventoryWebhook(
    shopDomain: string,
    webhookId: string,
    data: { inventory_item_id: number; available: number },
  ): Promise<void> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      return;
    }

    await this.prisma.webhookLog.create({
      data: {
        shopDomain,
        topic: 'inventory_levels/update',
        webhookId,
        payload: data as any,
      },
    });

    // Update inventory quantity for matching variants
    // Note: In production, you'd need to map inventory_item_id to variant_id
    // This would require storing the inventory_item_id on the variant
    await this.prisma.webhookLog.updateMany({
      where: { webhookId },
      data: { processed: true },
    });
  }

  // Start bulk backfill operation
  async startBackfill(shopDomain: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      throw new Error(`Shop not found: ${shopDomain}`);
    }

    const accessToken = this.encryption.decrypt(shop.accessToken);

    // Update status
    await this.prisma.shop.update({
      where: { id: shop.id },
      data: { syncStatus: SyncStatus.BACKFILL_PENDING },
    });

    try {
      const operationId = await this.shopify.startBulkOperation(shopDomain, accessToken);

      await this.prisma.bulkOperation.create({
        data: {
          shopId: shop.id,
          shopifyOpId: operationId,
          status: 'RUNNING',
        },
      });

      await this.prisma.shop.update({
        where: { id: shop.id },
        data: { syncStatus: SyncStatus.BACKFILL_RUNNING },
      });

      return operationId;
    } catch (error) {
      await this.prisma.shop.update({
        where: { id: shop.id },
        data: {
          syncStatus: SyncStatus.ERROR,
          syncError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  // Poll and process bulk operation
  async pollBulkOperation(shopDomain: string): Promise<{
    status: string;
    progress?: number;
  }> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      throw new Error(`Shop not found: ${shopDomain}`);
    }

    const accessToken = this.encryption.decrypt(shop.accessToken);
    const status = await this.shopify.getBulkOperationStatus(shopDomain, accessToken);

    if (status.status === 'COMPLETED' && status.url) {
      // Fetch and process results
      await this.processBulkResults(shop.id, status.url);

      await this.prisma.shop.update({
        where: { id: shop.id },
        data: {
          syncStatus: SyncStatus.BACKFILL_COMPLETE,
          lastSyncAt: new Date(),
          syncError: null,
        },
      });

      // Update bulk operation record
      await this.prisma.bulkOperation.updateMany({
        where: { shopId: shop.id, status: 'RUNNING' },
        data: {
          status: 'COMPLETED',
          url: status.url,
          objectCount: status.objectCount,
          completedAt: new Date(),
        },
      });
    } else if (status.status === 'FAILED') {
      await this.prisma.shop.update({
        where: { id: shop.id },
        data: {
          syncStatus: SyncStatus.ERROR,
          syncError: status.errorCode || 'Bulk operation failed',
        },
      });

      await this.prisma.bulkOperation.updateMany({
        where: { shopId: shop.id, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          errorCode: status.errorCode,
          completedAt: new Date(),
        },
      });
    }

    return { status: status.status };
  }

  // Process JSONL results from bulk operation
  private async processBulkResults(shopId: string, url: string): Promise<void> {
    const jsonlContent = await this.shopify.fetchBulkResults(url);
    const lines = jsonlContent.split('\n').filter(line => line.trim());

    const productMap = new Map<string, ShopifyProduct>();
    const variantsList: (ShopifyVariant & { __parentId: string })[] = [];

    // Parse JSONL - products and variants come as separate lines
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.id?.includes('/Product/')) {
          productMap.set(obj.id, obj);
        } else if (obj.id?.includes('/ProductVariant/')) {
          variantsList.push(obj);
        }
      } catch (e) {
        this.logger.warn(`Failed to parse JSONL line: ${line}`);
      }
    }

    // Process variants in batches
    const batchSize = 100;
    for (let i = 0; i < variantsList.length; i += batchSize) {
      const batch = variantsList.slice(i, i + batchSize);
      await this.processBulkVariantBatch(shopId, batch, productMap);
    }

    this.logger.log(`Processed ${variantsList.length} variants for shop ${shopId}`);
  }

  private async processBulkVariantBatch(
    shopId: string,
    variants: (ShopifyVariant & { __parentId: string })[],
    productMap: Map<string, ShopifyProduct>,
  ): Promise<void> {
    for (const variant of variants) {
      const product = productMap.get(variant.__parentId);
      if (!product) {
        continue;
      }

      const collections = product.collections?.edges.map(e => e.node.title) || [];
      const metafields = this.extractMetafields(product.metafields);
      const tags = product.tags || [];

      await this.upsertVariant(shopId, product, variant, collections, metafields, tags);
    }
  }

  // Upsert a single variant
  private async upsertVariant(
    shopId: string,
    product: ShopifyProduct,
    variant: ShopifyVariant,
    collections: string[],
    metafields: Record<string, string>,
    tags: string[],
  ): Promise<void> {
    const options = this.extractOptions(variant.selectedOptions);
    const canonicalText = this.buildCanonicalText(product, variant, collections, metafields);
    const embedding = await this.embeddings.generateEmbedding(canonicalText);

    const data = {
      shopId,
      productId: product.id,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor || null,
      productType: product.productType || null,
      tags: tags,
      variantTitle: variant.title || null,
      options,
      price: parseFloat(variant.price),
      compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
      currency: 'USD',
      available: variant.availableForSale,
      inventoryQuantity: variant.inventoryQuantity || null,
      metafields,
      collections,
      imageUrl: variant.image?.url || null,
      canonicalText,
    };

    // Use raw SQL for vector field
    await this.prisma.$executeRaw`
      INSERT INTO product_variants (
        id, shop_id, product_id, variant_id, handle, title, vendor, product_type,
        tags, variant_title, options, price, compare_at_price, currency, available,
        inventory_quantity, metafields, collections, image_url, canonical_text,
        embedding, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${data.shopId},
        ${data.productId},
        ${variant.id},
        ${data.handle},
        ${data.title},
        ${data.vendor},
        ${data.productType},
        ${data.tags},
        ${data.variantTitle},
        ${JSON.stringify(data.options)}::jsonb,
        ${data.price},
        ${data.compareAtPrice},
        ${data.currency},
        ${data.available},
        ${data.inventoryQuantity},
        ${JSON.stringify(data.metafields)}::jsonb,
        ${data.collections},
        ${data.imageUrl},
        ${data.canonicalText},
        ${`[${embedding.join(',')}]`}::vector,
        NOW(),
        NOW()
      )
      ON CONFLICT (shop_id, variant_id) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        handle = EXCLUDED.handle,
        title = EXCLUDED.title,
        vendor = EXCLUDED.vendor,
        product_type = EXCLUDED.product_type,
        tags = EXCLUDED.tags,
        variant_title = EXCLUDED.variant_title,
        options = EXCLUDED.options,
        price = EXCLUDED.price,
        compare_at_price = EXCLUDED.compare_at_price,
        available = EXCLUDED.available,
        inventory_quantity = EXCLUDED.inventory_quantity,
        metafields = EXCLUDED.metafields,
        collections = EXCLUDED.collections,
        image_url = EXCLUDED.image_url,
        canonical_text = EXCLUDED.canonical_text,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `;
  }

  // Delete all variants for a product
  private async deleteProductVariants(shopId: string, productId: string): Promise<void> {
    await this.prisma.productVariant.deleteMany({
      where: { shopId, productId },
    });
  }

  // Build canonical text for search
  private buildCanonicalText(
    product: ShopifyProduct,
    variant: ShopifyVariant,
    collections: string[],
    metafields: Record<string, string>,
  ): string {
    const parts = [
      product.title,
      product.vendor,
      product.productType,
      variant.title,
      ...(product.tags || []),
      ...collections,
      ...Object.values(metafields),
      ...Object.values(this.extractOptions(variant.selectedOptions)),
    ];

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  // Extract options from variant
  private extractOptions(
    selectedOptions?: Array<{ name: string; value: string }>,
  ): Record<string, string> {
    if (!selectedOptions) return {};
    return selectedOptions.reduce(
      (acc, opt) => ({ ...acc, [opt.name]: opt.value }),
      {},
    );
  }

  // Extract metafields into flat object
  private extractMetafields(
    metafields?: { edges: Array<{ node: { namespace: string; key: string; value: string } }> },
  ): Record<string, string> {
    if (!metafields?.edges) return {};
    return metafields.edges.reduce(
      (acc, edge) => ({
        ...acc,
        [`${edge.node.namespace}.${edge.node.key}`]: edge.node.value,
      }),
      {},
    );
  }

  // Get sync status for a shop
  async getSyncStatus(shopDomain: string): Promise<{
    status: string;
    lastSyncAt: Date | null;
    error: string | null;
    variantCount: number;
  }> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
      select: {
        syncStatus: true,
        lastSyncAt: true,
        syncError: true,
        _count: {
          select: { variants: true },
        },
      },
    });

    if (!shop) {
      return {
        status: 'NOT_INSTALLED',
        lastSyncAt: null,
        error: null,
        variantCount: 0,
      };
    }

    return {
      status: shop.syncStatus,
      lastSyncAt: shop.lastSyncAt,
      error: shop.syncError,
      variantCount: shop._count.variants,
    };
  }
}
