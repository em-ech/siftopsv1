import { PrismaClient, SyncStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Glossier-style products
const glossierProducts = [
  {
    productId: 'gid://shopify/Product/g1',
    handle: 'boy-brow',
    title: 'Boy Brow',
    vendor: 'Glossier',
    productType: 'Makeup',
    tags: ['brows', 'makeup', 'bestseller', 'natural'],
    collections: ['Makeup', 'Bestsellers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g101', variantTitle: 'Blonde', options: { Shade: 'Blonde' }, price: 18.00, inventoryQuantity: 120 },
      { variantId: 'gid://shopify/ProductVariant/g102', variantTitle: 'Brown', options: { Shade: 'Brown' }, price: 18.00, inventoryQuantity: 200 },
      { variantId: 'gid://shopify/ProductVariant/g103', variantTitle: 'Black', options: { Shade: 'Black' }, price: 18.00, inventoryQuantity: 150 },
      { variantId: 'gid://shopify/ProductVariant/g104', variantTitle: 'Clear', options: { Shade: 'Clear' }, price: 18.00, inventoryQuantity: 80 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g2',
    handle: 'cloud-paint',
    title: 'Cloud Paint',
    vendor: 'Glossier',
    productType: 'Makeup',
    tags: ['blush', 'cheeks', 'makeup', 'dewy', 'natural'],
    collections: ['Makeup', 'Bestsellers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g201', variantTitle: 'Puff', options: { Shade: 'Puff' }, price: 20.00, inventoryQuantity: 90 },
      { variantId: 'gid://shopify/ProductVariant/g202', variantTitle: 'Dusk', options: { Shade: 'Dusk' }, price: 20.00, inventoryQuantity: 110 },
      { variantId: 'gid://shopify/ProductVariant/g203', variantTitle: 'Beam', options: { Shade: 'Beam' }, price: 20.00, inventoryQuantity: 75 },
      { variantId: 'gid://shopify/ProductVariant/g204', variantTitle: 'Storm', options: { Shade: 'Storm' }, price: 20.00, inventoryQuantity: 85 },
      { variantId: 'gid://shopify/ProductVariant/g205', variantTitle: 'Dawn', options: { Shade: 'Dawn' }, price: 20.00, inventoryQuantity: 60 },
      { variantId: 'gid://shopify/ProductVariant/g206', variantTitle: 'Eve', options: { Shade: 'Eve' }, price: 20.00, inventoryQuantity: 45 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g3',
    handle: 'milky-jelly-cleanser',
    title: 'Milky Jelly Cleanser',
    vendor: 'Glossier',
    productType: 'Skincare',
    tags: ['cleanser', 'skincare', 'gentle', 'hydrating', 'bestseller'],
    collections: ['Skincare', 'Bestsellers', 'Cleansers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g301', variantTitle: '6 fl oz', options: { Size: '6 fl oz' }, price: 20.00, inventoryQuantity: 300 },
      { variantId: 'gid://shopify/ProductVariant/g302', variantTitle: '2 fl oz', options: { Size: '2 fl oz' }, price: 9.00, inventoryQuantity: 150 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g4',
    handle: 'priming-moisturizer',
    title: 'Priming Moisturizer',
    vendor: 'Glossier',
    productType: 'Skincare',
    tags: ['moisturizer', 'skincare', 'hydrating', 'primer', 'daily'],
    collections: ['Skincare', 'Moisturizers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g401', variantTitle: 'Original', options: { Type: 'Original' }, price: 25.00, inventoryQuantity: 180 },
      { variantId: 'gid://shopify/ProductVariant/g402', variantTitle: 'Rich', options: { Type: 'Rich' }, price: 35.00, inventoryQuantity: 120 },
      { variantId: 'gid://shopify/ProductVariant/g403', variantTitle: 'Balance', options: { Type: 'Balance' }, price: 25.00, inventoryQuantity: 90 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g5',
    handle: 'balm-dotcom',
    title: 'Balm Dotcom',
    vendor: 'Glossier',
    productType: 'Skincare',
    tags: ['lip balm', 'lips', 'hydrating', 'multipurpose', 'bestseller'],
    collections: ['Skincare', 'Lips', 'Bestsellers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g501', variantTitle: 'Original', options: { Flavor: 'Original' }, price: 14.00, inventoryQuantity: 250 },
      { variantId: 'gid://shopify/ProductVariant/g502', variantTitle: 'Rose', options: { Flavor: 'Rose' }, price: 14.00, inventoryQuantity: 180 },
      { variantId: 'gid://shopify/ProductVariant/g503', variantTitle: 'Mint', options: { Flavor: 'Mint' }, price: 14.00, inventoryQuantity: 160 },
      { variantId: 'gid://shopify/ProductVariant/g504', variantTitle: 'Berry', options: { Flavor: 'Berry' }, price: 14.00, inventoryQuantity: 200 },
      { variantId: 'gid://shopify/ProductVariant/g505', variantTitle: 'Coconut', options: { Flavor: 'Coconut' }, price: 14.00, inventoryQuantity: 140 },
      { variantId: 'gid://shopify/ProductVariant/g506', variantTitle: 'Cherry', options: { Flavor: 'Cherry' }, price: 14.00, inventoryQuantity: 170 },
      { variantId: 'gid://shopify/ProductVariant/g507', variantTitle: 'Birthday', options: { Flavor: 'Birthday Balm Dotcom' }, price: 14.00, inventoryQuantity: 90 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g6',
    handle: 'futuredew',
    title: 'Futuredew',
    vendor: 'Glossier',
    productType: 'Skincare',
    tags: ['serum', 'glow', 'dewy', 'oil', 'skincare'],
    collections: ['Skincare', 'Serums'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g601', variantTitle: 'Default', options: { Size: '1 fl oz' }, price: 26.00, inventoryQuantity: 100 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g7',
    handle: 'lash-slick',
    title: 'Lash Slick',
    vendor: 'Glossier',
    productType: 'Makeup',
    tags: ['mascara', 'lashes', 'makeup', 'natural', 'bestseller'],
    collections: ['Makeup', 'Bestsellers', 'Eyes'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g701', variantTitle: 'Black', options: { Color: 'Black' }, price: 18.00, inventoryQuantity: 220 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g8',
    handle: 'stretch-concealer',
    title: 'Stretch Concealer',
    vendor: 'Glossier',
    productType: 'Makeup',
    tags: ['concealer', 'makeup', 'coverage', 'natural', 'buildable'],
    collections: ['Makeup', 'Face'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g801', variantTitle: 'G1', options: { Shade: 'G1' }, price: 20.00, inventoryQuantity: 50 },
      { variantId: 'gid://shopify/ProductVariant/g802', variantTitle: 'G2', options: { Shade: 'G2' }, price: 20.00, inventoryQuantity: 65 },
      { variantId: 'gid://shopify/ProductVariant/g803', variantTitle: 'G3', options: { Shade: 'G3' }, price: 20.00, inventoryQuantity: 70 },
      { variantId: 'gid://shopify/ProductVariant/g804', variantTitle: 'G4', options: { Shade: 'G4' }, price: 20.00, inventoryQuantity: 80 },
      { variantId: 'gid://shopify/ProductVariant/g805', variantTitle: 'G5', options: { Shade: 'G5' }, price: 20.00, inventoryQuantity: 90 },
      { variantId: 'gid://shopify/ProductVariant/g806', variantTitle: 'G6', options: { Shade: 'G6' }, price: 20.00, inventoryQuantity: 85 },
      { variantId: 'gid://shopify/ProductVariant/g807', variantTitle: 'G7', options: { Shade: 'G7' }, price: 20.00, inventoryQuantity: 75 },
      { variantId: 'gid://shopify/ProductVariant/g808', variantTitle: 'G8', options: { Shade: 'G8' }, price: 20.00, inventoryQuantity: 60 },
      { variantId: 'gid://shopify/ProductVariant/g809', variantTitle: 'G9', options: { Shade: 'G9' }, price: 20.00, inventoryQuantity: 55 },
      { variantId: 'gid://shopify/ProductVariant/g810', variantTitle: 'G10', options: { Shade: 'G10' }, price: 20.00, inventoryQuantity: 45 },
      { variantId: 'gid://shopify/ProductVariant/g811', variantTitle: 'G11', options: { Shade: 'G11' }, price: 20.00, inventoryQuantity: 40 },
      { variantId: 'gid://shopify/ProductVariant/g812', variantTitle: 'G12', options: { Shade: 'G12' }, price: 20.00, inventoryQuantity: 35 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g9',
    handle: 'you-perfume',
    title: 'You',
    vendor: 'Glossier',
    productType: 'Fragrance',
    tags: ['perfume', 'fragrance', 'signature', 'bestseller'],
    collections: ['Fragrance', 'Bestsellers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g901', variantTitle: 'Eau de Parfum 1.7 fl oz', options: { Size: '1.7 fl oz' }, price: 65.00, inventoryQuantity: 60 },
      { variantId: 'gid://shopify/ProductVariant/g902', variantTitle: 'Solid', options: { Size: 'Solid' }, price: 25.00, inventoryQuantity: 80 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g10',
    handle: 'super-pure',
    title: 'Super Pure',
    vendor: 'Glossier',
    productType: 'Skincare',
    tags: ['serum', 'niacinamide', 'acne', 'skincare', 'blemish'],
    collections: ['Skincare', 'Serums', 'Supers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g1001', variantTitle: 'Default', options: { Size: '1 fl oz' }, price: 28.00, inventoryQuantity: 70 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g11',
    handle: 'super-bounce',
    title: 'Super Bounce',
    vendor: 'Glossier',
    productType: 'Skincare',
    tags: ['serum', 'hyaluronic acid', 'hydrating', 'skincare', 'plumping'],
    collections: ['Skincare', 'Serums', 'Supers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g1101', variantTitle: 'Default', options: { Size: '1 fl oz' }, price: 28.00, inventoryQuantity: 85 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g12',
    handle: 'super-glow',
    title: 'Super Glow',
    vendor: 'Glossier',
    productType: 'Skincare',
    tags: ['serum', 'vitamin c', 'brightening', 'skincare', 'glow'],
    collections: ['Skincare', 'Serums', 'Supers'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g1201', variantTitle: 'Default', options: { Size: '1 fl oz' }, price: 28.00, inventoryQuantity: 65 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g13',
    handle: 'generation-g',
    title: 'Generation G',
    vendor: 'Glossier',
    productType: 'Makeup',
    tags: ['lipstick', 'lips', 'sheer', 'makeup', 'natural'],
    collections: ['Makeup', 'Lips'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g1301', variantTitle: 'Cake', options: { Shade: 'Cake' }, price: 20.00, inventoryQuantity: 55 },
      { variantId: 'gid://shopify/ProductVariant/g1302', variantTitle: 'Like', options: { Shade: 'Like' }, price: 20.00, inventoryQuantity: 70 },
      { variantId: 'gid://shopify/ProductVariant/g1303', variantTitle: 'Crush', options: { Shade: 'Crush' }, price: 20.00, inventoryQuantity: 60 },
      { variantId: 'gid://shopify/ProductVariant/g1304', variantTitle: 'Zip', options: { Shade: 'Zip' }, price: 20.00, inventoryQuantity: 50 },
      { variantId: 'gid://shopify/ProductVariant/g1305', variantTitle: 'Jam', options: { Shade: 'Jam' }, price: 20.00, inventoryQuantity: 45 },
      { variantId: 'gid://shopify/ProductVariant/g1306', variantTitle: 'Leo', options: { Shade: 'Leo' }, price: 20.00, inventoryQuantity: 40 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g14',
    handle: 'skin-tint',
    title: 'Perfecting Skin Tint',
    vendor: 'Glossier',
    productType: 'Makeup',
    tags: ['foundation', 'tint', 'sheer', 'makeup', 'natural', 'dewy'],
    collections: ['Makeup', 'Face'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g1401', variantTitle: 'G1', options: { Shade: 'G1' }, price: 28.00, inventoryQuantity: 40 },
      { variantId: 'gid://shopify/ProductVariant/g1402', variantTitle: 'G2', options: { Shade: 'G2' }, price: 28.00, inventoryQuantity: 50 },
      { variantId: 'gid://shopify/ProductVariant/g1403', variantTitle: 'G3', options: { Shade: 'G3' }, price: 28.00, inventoryQuantity: 55 },
      { variantId: 'gid://shopify/ProductVariant/g1404', variantTitle: 'G4', options: { Shade: 'G4' }, price: 28.00, inventoryQuantity: 60 },
      { variantId: 'gid://shopify/ProductVariant/g1405', variantTitle: 'G5', options: { Shade: 'G5' }, price: 28.00, inventoryQuantity: 70 },
      { variantId: 'gid://shopify/ProductVariant/g1406', variantTitle: 'G6', options: { Shade: 'G6' }, price: 28.00, inventoryQuantity: 65 },
      { variantId: 'gid://shopify/ProductVariant/g1407', variantTitle: 'G7', options: { Shade: 'G7' }, price: 28.00, inventoryQuantity: 55 },
      { variantId: 'gid://shopify/ProductVariant/g1408', variantTitle: 'G8', options: { Shade: 'G8' }, price: 28.00, inventoryQuantity: 45 },
      { variantId: 'gid://shopify/ProductVariant/g1409', variantTitle: 'G9', options: { Shade: 'G9' }, price: 28.00, inventoryQuantity: 40 },
      { variantId: 'gid://shopify/ProductVariant/g1410', variantTitle: 'G10', options: { Shade: 'G10' }, price: 28.00, inventoryQuantity: 35 },
      { variantId: 'gid://shopify/ProductVariant/g1411', variantTitle: 'G11', options: { Shade: 'G11' }, price: 28.00, inventoryQuantity: 30 },
      { variantId: 'gid://shopify/ProductVariant/g1412', variantTitle: 'G12', options: { Shade: 'G12' }, price: 28.00, inventoryQuantity: 25 },
    ],
  },
  {
    productId: 'gid://shopify/Product/g15',
    handle: 'haloscope',
    title: 'Haloscope',
    vendor: 'Glossier',
    productType: 'Makeup',
    tags: ['highlighter', 'glow', 'dewy', 'makeup', 'natural'],
    collections: ['Makeup', 'Face'],
    variants: [
      { variantId: 'gid://shopify/ProductVariant/g1501', variantTitle: 'Moonstone', options: { Shade: 'Moonstone' }, price: 24.00, inventoryQuantity: 55 },
      { variantId: 'gid://shopify/ProductVariant/g1502', variantTitle: 'Quartz', options: { Shade: 'Quartz' }, price: 24.00, inventoryQuantity: 70 },
      { variantId: 'gid://shopify/ProductVariant/g1503', variantTitle: 'Topaz', options: { Shade: 'Topaz' }, price: 24.00, inventoryQuantity: 45 },
    ],
  },
];

// Generate deterministic embedding from text
function generateDeterministicEmbedding(text: string): number[] {
  const hashes: string[] = [];
  for (let i = 0; i < 12; i++) {
    const hash = crypto.createHash('sha256').update(text + ':' + i).digest('hex');
    hashes.push(hash);
  }

  const combined = hashes.join('');
  const embedding: number[] = [];

  for (let i = 0; i < 384; i++) {
    const hexPair = combined.slice(i * 2, i * 2 + 2);
    const value = parseInt(hexPair, 16) / 127.5 - 1;
    embedding.push(value);
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

function buildCanonicalText(product: typeof glossierProducts[0], variant: typeof glossierProducts[0]['variants'][0]): string {
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
  console.log('Seeding Glossier mock data...');

  // Create Glossier shop
  const glossierShop = await prisma.shop.upsert({
    where: { shopDomain: 'glossier.myshopify.com' },
    update: {
      syncStatus: SyncStatus.BACKFILL_COMPLETE,
      lastSyncAt: new Date(),
    },
    create: {
      shopDomain: 'glossier.myshopify.com',
      accessToken: 'mock_glossier_token',
      syncStatus: SyncStatus.BACKFILL_COMPLETE,
      lastSyncAt: new Date(),
    },
  });

  console.log(`Created/updated shop: ${glossierShop.shopDomain}`);

  // Delete existing variants for this shop
  await prisma.productVariant.deleteMany({
    where: { shopId: glossierShop.id },
  });

  // Create product variants
  let variantCount = 0;
  for (const product of glossierProducts) {
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
          ${glossierShop.id},
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

  console.log(`Created ${variantCount} Glossier product variants`);
  console.log('Glossier mock data seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
