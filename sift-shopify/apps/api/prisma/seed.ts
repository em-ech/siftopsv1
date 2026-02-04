import { PrismaClient, SyncStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Sample products for demo mode
const sampleProducts = [
  {
    productId: 'gid://shopify/Product/1',
    handle: 'classic-cotton-tshirt',
    title: 'Classic Cotton T-Shirt',
    vendor: 'SiftWear',
    productType: 'T-Shirts',
    tags: ['cotton', 'casual', 'summer', 'bestseller'],
    collections: ['Summer Collection', 'Basics'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/101', variantTitle: 'Small / White', options: { Size: 'Small', Color: 'White' }, price: 24.99, inventoryQuantity: 50 },
      { variantId: 'gid://shopify/ProductVariant/102', variantTitle: 'Medium / White', options: { Size: 'Medium', Color: 'White' }, price: 24.99, inventoryQuantity: 75 },
      { variantId: 'gid://shopify/ProductVariant/103', variantTitle: 'Large / White', options: { Size: 'Large', Color: 'White' }, price: 24.99, inventoryQuantity: 60 },
      { variantId: 'gid://shopify/ProductVariant/104', variantTitle: 'Small / Black', options: { Size: 'Small', Color: 'Black' }, price: 24.99, inventoryQuantity: 45 },
      { variantId: 'gid://shopify/ProductVariant/105', variantTitle: 'Medium / Black', options: { Size: 'Medium', Color: 'Black' }, price: 24.99, inventoryQuantity: 80 },
      { variantId: 'gid://shopify/ProductVariant/106', variantTitle: 'Large / Black', options: { Size: 'Large', Color: 'Black' }, price: 24.99, inventoryQuantity: 55 },
    ],
  },
  {
    productId: 'gid://shopify/Product/2',
    handle: 'premium-denim-jeans',
    title: 'Premium Denim Jeans',
    vendor: 'SiftWear',
    productType: 'Jeans',
    tags: ['denim', 'premium', 'casual', 'classic'],
    collections: ['Denim Collection', 'Bestsellers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/201', variantTitle: '30 / Blue', options: { Waist: '30', Color: 'Blue' }, price: 79.99, inventoryQuantity: 30 },
      { variantId: 'gid://shopify/ProductVariant/202', variantTitle: '32 / Blue', options: { Waist: '32', Color: 'Blue' }, price: 79.99, inventoryQuantity: 45 },
      { variantId: 'gid://shopify/ProductVariant/203', variantTitle: '34 / Blue', options: { Waist: '34', Color: 'Blue' }, price: 79.99, inventoryQuantity: 40 },
      { variantId: 'gid://shopify/ProductVariant/204', variantTitle: '32 / Black', options: { Waist: '32', Color: 'Black' }, price: 79.99, inventoryQuantity: 35 },
      { variantId: 'gid://shopify/ProductVariant/205', variantTitle: '34 / Black', options: { Waist: '34', Color: 'Black' }, price: 79.99, inventoryQuantity: 25 },
    ],
  },
  {
    productId: 'gid://shopify/Product/3',
    handle: 'cozy-wool-sweater',
    title: 'Cozy Wool Sweater',
    vendor: 'SiftWear',
    productType: 'Sweaters',
    tags: ['wool', 'winter', 'cozy', 'warm'],
    collections: ['Winter Collection', 'Knitwear'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/301', variantTitle: 'Small / Gray', options: { Size: 'Small', Color: 'Gray' }, price: 89.99, inventoryQuantity: 20 },
      { variantId: 'gid://shopify/ProductVariant/302', variantTitle: 'Medium / Gray', options: { Size: 'Medium', Color: 'Gray' }, price: 89.99, inventoryQuantity: 35 },
      { variantId: 'gid://shopify/ProductVariant/303', variantTitle: 'Large / Gray', options: { Size: 'Large', Color: 'Gray' }, price: 89.99, inventoryQuantity: 25 },
      { variantId: 'gid://shopify/ProductVariant/304', variantTitle: 'Medium / Navy', options: { Size: 'Medium', Color: 'Navy' }, price: 89.99, inventoryQuantity: 30 },
    ],
  },
  {
    productId: 'gid://shopify/Product/4',
    handle: 'athletic-running-shoes',
    title: 'Athletic Running Shoes',
    vendor: 'SiftSport',
    productType: 'Shoes',
    tags: ['athletic', 'running', 'sports', 'breathable'],
    collections: ['Athletic Collection', 'Footwear'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/401', variantTitle: '8 / White', options: { Size: '8', Color: 'White' }, price: 129.99, inventoryQuantity: 15 },
      { variantId: 'gid://shopify/ProductVariant/402', variantTitle: '9 / White', options: { Size: '9', Color: 'White' }, price: 129.99, inventoryQuantity: 20 },
      { variantId: 'gid://shopify/ProductVariant/403', variantTitle: '10 / White', options: { Size: '10', Color: 'White' }, price: 129.99, inventoryQuantity: 25 },
      { variantId: 'gid://shopify/ProductVariant/404', variantTitle: '9 / Black', options: { Size: '9', Color: 'Black' }, price: 129.99, inventoryQuantity: 18 },
      { variantId: 'gid://shopify/ProductVariant/405', variantTitle: '10 / Black', options: { Size: '10', Color: 'Black' }, price: 129.99, inventoryQuantity: 22 },
      { variantId: 'gid://shopify/ProductVariant/406', variantTitle: '11 / Black', options: { Size: '11', Color: 'Black' }, price: 129.99, inventoryQuantity: 12 },
    ],
  },
  {
    productId: 'gid://shopify/Product/5',
    handle: 'leather-messenger-bag',
    title: 'Leather Messenger Bag',
    vendor: 'SiftAccessories',
    productType: 'Bags',
    tags: ['leather', 'professional', 'work', 'premium'],
    collections: ['Accessories', 'Professional'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/501', variantTitle: 'Brown', options: { Color: 'Brown' }, price: 149.99, inventoryQuantity: 10 },
      { variantId: 'gid://shopify/ProductVariant/502', variantTitle: 'Black', options: { Color: 'Black' }, price: 149.99, inventoryQuantity: 15 },
      { variantId: 'gid://shopify/ProductVariant/503', variantTitle: 'Tan', options: { Color: 'Tan' }, price: 149.99, inventoryQuantity: 8 },
    ],
  },
  {
    productId: 'gid://shopify/Product/6',
    handle: 'summer-floral-dress',
    title: 'Summer Floral Dress',
    vendor: 'SiftWear',
    productType: 'Dresses',
    tags: ['summer', 'floral', 'casual', 'lightweight'],
    collections: ['Summer Collection', 'Dresses'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/601', variantTitle: 'XS / Blue Floral', options: { Size: 'XS', Pattern: 'Blue Floral' }, price: 59.99, inventoryQuantity: 12 },
      { variantId: 'gid://shopify/ProductVariant/602', variantTitle: 'S / Blue Floral', options: { Size: 'S', Pattern: 'Blue Floral' }, price: 59.99, inventoryQuantity: 18 },
      { variantId: 'gid://shopify/ProductVariant/603', variantTitle: 'M / Blue Floral', options: { Size: 'M', Pattern: 'Blue Floral' }, price: 59.99, inventoryQuantity: 22 },
      { variantId: 'gid://shopify/ProductVariant/604', variantTitle: 'S / Pink Floral', options: { Size: 'S', Pattern: 'Pink Floral' }, price: 59.99, inventoryQuantity: 15 },
      { variantId: 'gid://shopify/ProductVariant/605', variantTitle: 'M / Pink Floral', options: { Size: 'M', Pattern: 'Pink Floral' }, price: 59.99, inventoryQuantity: 20 },
    ],
  },
  {
    productId: 'gid://shopify/Product/7',
    handle: 'waterproof-hiking-jacket',
    title: 'Waterproof Hiking Jacket',
    vendor: 'SiftOutdoors',
    productType: 'Jackets',
    tags: ['outdoor', 'waterproof', 'hiking', 'adventure'],
    collections: ['Outdoor Collection', 'Jackets'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/701', variantTitle: 'S / Green', options: { Size: 'S', Color: 'Green' }, price: 189.99, inventoryQuantity: 8 },
      { variantId: 'gid://shopify/ProductVariant/702', variantTitle: 'M / Green', options: { Size: 'M', Color: 'Green' }, price: 189.99, inventoryQuantity: 14 },
      { variantId: 'gid://shopify/ProductVariant/703', variantTitle: 'L / Green', options: { Size: 'L', Color: 'Green' }, price: 189.99, inventoryQuantity: 10 },
      { variantId: 'gid://shopify/ProductVariant/704', variantTitle: 'M / Orange', options: { Size: 'M', Color: 'Orange' }, price: 189.99, inventoryQuantity: 6 },
      { variantId: 'gid://shopify/ProductVariant/705', variantTitle: 'L / Orange', options: { Size: 'L', Color: 'Orange' }, price: 189.99, inventoryQuantity: 9 },
    ],
  },
  {
    productId: 'gid://shopify/Product/8',
    handle: 'silk-scarf-collection',
    title: 'Silk Scarf Collection',
    vendor: 'SiftAccessories',
    productType: 'Scarves',
    tags: ['silk', 'luxury', 'elegant', 'gift'],
    collections: ['Accessories', 'Gift Ideas'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/801', variantTitle: 'Paisley Red', options: { Pattern: 'Paisley Red' }, price: 45.99, inventoryQuantity: 25 },
      { variantId: 'gid://shopify/ProductVariant/802', variantTitle: 'Abstract Blue', options: { Pattern: 'Abstract Blue' }, price: 45.99, inventoryQuantity: 30 },
      { variantId: 'gid://shopify/ProductVariant/803', variantTitle: 'Geometric Gold', options: { Pattern: 'Geometric Gold' }, price: 49.99, inventoryQuantity: 20 },
      { variantId: 'gid://shopify/ProductVariant/804', variantTitle: 'Solid Black', options: { Pattern: 'Solid Black' }, price: 39.99, inventoryQuantity: 40 },
    ],
  },
  {
    productId: 'gid://shopify/Product/9',
    handle: 'organic-cotton-hoodie',
    title: 'Organic Cotton Hoodie',
    vendor: 'SiftWear',
    productType: 'Hoodies',
    tags: ['organic', 'sustainable', 'casual', 'eco-friendly'],
    collections: ['Sustainable Collection', 'Basics'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/901', variantTitle: 'S / Heather Gray', options: { Size: 'S', Color: 'Heather Gray' }, price: 69.99, inventoryQuantity: 18 },
      { variantId: 'gid://shopify/ProductVariant/902', variantTitle: 'M / Heather Gray', options: { Size: 'M', Color: 'Heather Gray' }, price: 69.99, inventoryQuantity: 25 },
      { variantId: 'gid://shopify/ProductVariant/903', variantTitle: 'L / Heather Gray', options: { Size: 'L', Color: 'Heather Gray' }, price: 69.99, inventoryQuantity: 22 },
      { variantId: 'gid://shopify/ProductVariant/904', variantTitle: 'XL / Heather Gray', options: { Size: 'XL', Color: 'Heather Gray' }, price: 69.99, inventoryQuantity: 15 },
      { variantId: 'gid://shopify/ProductVariant/905', variantTitle: 'M / Forest Green', options: { Size: 'M', Color: 'Forest Green' }, price: 69.99, inventoryQuantity: 20 },
      { variantId: 'gid://shopify/ProductVariant/906', variantTitle: 'L / Forest Green', options: { Size: 'L', Color: 'Forest Green' }, price: 69.99, inventoryQuantity: 16 },
    ],
  },
  {
    productId: 'gid://shopify/Product/10',
    handle: 'vintage-sunglasses',
    title: 'Vintage Sunglasses',
    vendor: 'SiftAccessories',
    productType: 'Eyewear',
    tags: ['vintage', 'retro', 'summer', 'UV protection'],
    collections: ['Summer Collection', 'Accessories'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/1001', variantTitle: 'Tortoise', options: { Style: 'Tortoise' }, price: 79.99, inventoryQuantity: 12 },
      { variantId: 'gid://shopify/ProductVariant/1002', variantTitle: 'Black', options: { Style: 'Black' }, price: 79.99, inventoryQuantity: 18 },
      { variantId: 'gid://shopify/ProductVariant/1003', variantTitle: 'Gold', options: { Style: 'Gold' }, price: 89.99, inventoryQuantity: 8 },
    ],
  },
];

// Generate deterministic embedding from text
function generateDeterministicEmbedding(text: string): number[] {
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const embedding: number[] = [];

  // Generate 384-dimensional embedding from hash
  for (let i = 0; i < 384; i++) {
    const idx = i % 64;
    const charCode = hash.charCodeAt(idx);
    // Normalize to [-1, 1] range
    embedding.push((charCode / 127.5) - 1);
  }

  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

// Build canonical text for a variant
function buildCanonicalText(product: typeof sampleProducts[0], variant: typeof sampleProducts[0]['variants'][0]): string {
  const parts = [
    product.title,
    product.vendor,
    product.productType,
    variant.variantTitle,
    ...product.tags,
    ...product.collections,
    ...Object.values(variant.options),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

async function main() {
  console.log('Seeding database with demo data...');

  // Create demo shop
  const demoShop = await prisma.shop.upsert({
    where: { shopDomain: 'demo-store.myshopify.com' },
    update: {
      syncStatus: SyncStatus.BACKFILL_COMPLETE,
      lastSyncAt: new Date(),
    },
    create: {
      shopDomain: 'demo-store.myshopify.com',
      accessToken: 'demo_token_encrypted', // Not a real token
      syncStatus: SyncStatus.BACKFILL_COMPLETE,
      lastSyncAt: new Date(),
    },
  });

  console.log(`Created/updated demo shop: ${demoShop.shopDomain}`);

  // Delete existing variants for demo shop
  await prisma.productVariant.deleteMany({
    where: { shopId: demoShop.id },
  });

  // Create product variants
  let variantCount = 0;
  for (const product of sampleProducts) {
    for (const variant of product.variants) {
      const canonicalText = buildCanonicalText(product, variant);
      const embedding = generateDeterministicEmbedding(canonicalText);

      await prisma.$executeRaw`
        INSERT INTO product_variants (
          id, shop_id, product_id, variant_id, handle, title, vendor, product_type,
          tags, variant_title, options, price, currency, available, inventory_quantity,
          collections, canonical_text, embedding, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${demoShop.id},
          ${product.productId},
          ${variant.variantId},
          ${product.handle},
          ${product.title},
          ${product.vendor},
          ${product.productType},
          ${product.tags},
          ${variant.variantTitle},
          ${JSON.stringify(variant.options)}::jsonb,
          ${variant.price},
          'USD',
          true,
          ${variant.inventoryQuantity},
          ${product.collections},
          ${canonicalText},
          ${`[${embedding.join(',')}]`}::vector,
          NOW(),
          NOW()
        )
      `;
      variantCount++;
    }
  }

  console.log(`Created ${variantCount} product variants`);

  // Create full-text search index if not exists
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_product_variants_fts
    ON product_variants
    USING gin(to_tsvector('english', canonical_text || ' ' || title || ' ' || COALESCE(vendor, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(variant_title, '')))
  `;

  // Create vector similarity index if not exists
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_product_variants_embedding
    ON product_variants
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  console.log('Created search indexes');

  // Create some sample search events for analytics
  const searchQueries = ['shirt', 'jeans', 'shoes', 'summer', 'black', 'dress', 'cotton'];
  const variants = ['CONTROL', 'TREATMENT'];

  for (let i = 0; i < 50; i++) {
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const variant = variants[Math.floor(Math.random() * variants.length)];
    const hasClick = Math.random() > 0.5;
    const hasPurchase = hasClick && Math.random() > 0.7;

    await prisma.searchEvent.create({
      data: {
        shopId: demoShop.id,
        sessionId: `session_${i}`,
        variant: variant as 'CONTROL' | 'TREATMENT',
        query,
        resultCount: Math.floor(Math.random() * 20) + 1,
        results: [],
        clickedVariantId: hasClick ? `gid://shopify/ProductVariant/${Math.floor(Math.random() * 10) + 1}01` : null,
        purchasedVariantId: hasPurchase ? `gid://shopify/ProductVariant/${Math.floor(Math.random() * 10) + 1}01` : null,
        revenue: hasPurchase ? Math.random() * 100 + 20 : null,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date in last 7 days
      },
    });
  }

  console.log('Created 50 sample search events');

  // Create sample overrides
  await prisma.manualOverride.createMany({
    data: [
      {
        shopId: demoShop.id,
        scopeType: 'QUERY',
        scopeValue: 'summer',
        variantId: 'gid://shopify/ProductVariant/601',
        action: 'PIN',
        weight: 1.0,
      },
      {
        shopId: demoShop.id,
        scopeType: 'GLOBAL',
        scopeValue: null,
        variantId: 'gid://shopify/ProductVariant/105',
        action: 'BOOST',
        weight: 1.5,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Created sample overrides');
  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
