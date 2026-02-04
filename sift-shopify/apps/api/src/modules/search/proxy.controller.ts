import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { SearchService, SearchResult } from './search.service';
import { ShopifyService } from '../shopify/shopify.service';
import { PrismaService } from '../../prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { config } from '../../env';

interface ProxySearchResponse {
  results: Array<{
    variantId: string;
    productId: string;
    handle: string;
    title: string;
    variantTitle: string | null;
    vendor: string | null;
    productType: string | null;
    price: string;
    currency: string;
    available: boolean;
    inventoryQuantity: number | null;
    imageUrl: string | null;
    options: Record<string, string>;
    score: number;
  }>;
  query: string;
  totalResults: number;
}

@Controller('proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly shopify: ShopifyService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('search')
  async search(
    @Query() queryParams: Record<string, string>,
  ): Promise<ProxySearchResponse> {
    const { shop, q, region, session_id, signature, ...rest } = queryParams;

    // Verify App Proxy signature in production
    if (!config.DEMO_MODE && config.SHOPIFY_API_SECRET) {
      if (!this.shopify.verifyAppProxySignature(queryParams)) {
        this.logger.warn(`Invalid App Proxy signature for shop: ${shop}`);
        throw new UnauthorizedException('Invalid signature');
      }
    }

    if (!shop) {
      throw new BadRequestException('shop parameter is required');
    }

    if (!q || q.trim().length === 0) {
      return {
        results: [],
        query: '',
        totalResults: 0,
      };
    }

    // Find shop
    const shopRecord = await this.prisma.shop.findUnique({
      where: { shopDomain: shop },
    });

    if (!shopRecord) {
      throw new BadRequestException(`Shop not found: ${shop}`);
    }

    const results = await this.searchService.search({
      shopId: shopRecord.id,
      query: q.trim(),
      limit: 20,
      availableOnly: true,
      region,
      sessionId: session_id,
      variant: 'treatment',
    });

    // Record search event
    await this.analytics.recordSearchEvent({
      shopId: shopRecord.id,
      query: q.trim(),
      sessionId: session_id,
      variant: 'treatment',
      region,
      results: results.map(r => r.variantId),
      resultCount: results.length,
    });

    // Return simplified response for theme usage
    return {
      results: results.map(r => ({
        variantId: r.variantId,
        productId: r.productId,
        handle: r.handle,
        title: r.title,
        variantTitle: r.variantTitle,
        vendor: r.vendor,
        productType: r.productType,
        price: r.price,
        currency: r.currency,
        available: r.available,
        inventoryQuantity: r.inventoryQuantity,
        imageUrl: r.imageUrl,
        options: r.options,
        score: r.score,
      })),
      query: q.trim(),
      totalResults: results.length,
    };
  }
}
