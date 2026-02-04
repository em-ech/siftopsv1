export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_SCOPES: string;
  APP_URL: string;
  FRONTEND_URL: string;
  ENCRYPTION_KEY: string;
  DEMO_MODE: boolean;
  USE_EXTERNAL_EMBEDDINGS: boolean;
  OPENAI_API_KEY: string;
}

export function loadEnv(): EnvConfig {
  const env = process.env;

  return {
    NODE_ENV: env.NODE_ENV || 'development',
    PORT: parseInt(env.PORT || '4000', 10),
    DATABASE_URL: env.DATABASE_URL || 'postgresql://sift:sift_dev_password@localhost:5432/sift',
    REDIS_URL: env.REDIS_URL || 'redis://localhost:6379',
    SHOPIFY_API_KEY: env.SHOPIFY_API_KEY || '',
    SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET || '',
    SHOPIFY_SCOPES: env.SHOPIFY_SCOPES || 'read_products,read_inventory,read_locations,read_metafields,read_product_listings,read_publications',
    APP_URL: env.APP_URL || 'http://localhost:4000',
    FRONTEND_URL: env.FRONTEND_URL || 'http://localhost:3000',
    ENCRYPTION_KEY: env.ENCRYPTION_KEY || 'dev_encryption_key_32_characters!',
    DEMO_MODE: env.DEMO_MODE === 'true',
    USE_EXTERNAL_EMBEDDINGS: env.USE_EXTERNAL_EMBEDDINGS === 'true',
    OPENAI_API_KEY: env.OPENAI_API_KEY || '',
  };
}

export const config = loadEnv();
