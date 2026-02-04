-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'BACKFILL_PENDING', 'BACKFILL_RUNNING', 'BACKFILL_COMPLETE', 'ERROR');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('QUERY', 'CATEGORY', 'GLOBAL');

-- CreateEnum
CREATE TYPE "OverrideAction" AS ENUM ('PIN', 'BOOST', 'DEMOTE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "SearchVariant" AS ENUM ('CONTROL', 'TREATMENT');

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalled_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "sync_error" TEXT,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vendor" TEXT,
    "product_type" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variant_title" TEXT,
    "options" JSONB DEFAULT '{}',
    "price" DECIMAL(10,2) NOT NULL,
    "compare_at_price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "inventory_quantity" INTEGER,
    "metafields" JSONB DEFAULT '{}',
    "collections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "image_url" TEXT,
    "canonical_text" TEXT NOT NULL,
    "embedding" vector(384),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_overrides" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_value" TEXT,
    "variant_id" TEXT NOT NULL,
    "action" "OverrideAction" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_events" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "session_id" TEXT,
    "variant" "SearchVariant" NOT NULL DEFAULT 'CONTROL',
    "query" TEXT NOT NULL,
    "region" TEXT,
    "results" JSONB NOT NULL DEFAULT '[]',
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_variant_id" TEXT,
    "purchased_variant_id" TEXT,
    "revenue" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_operations" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "shopify_op_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "url" TEXT,
    "error_code" TEXT,
    "object_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_shop_domain_key" ON "shops"("shop_domain");

-- CreateIndex
CREATE INDEX "product_variants_shop_id_handle_idx" ON "product_variants"("shop_id", "handle");

-- CreateIndex
CREATE INDEX "product_variants_shop_id_product_id_idx" ON "product_variants"("shop_id", "product_id");

-- CreateIndex
CREATE INDEX "product_variants_shop_id_available_idx" ON "product_variants"("shop_id", "available");

-- CreateIndex
CREATE INDEX "product_variants_product_type_idx" ON "product_variants"("product_type");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_shop_id_variant_id_key" ON "product_variants"("shop_id", "variant_id");

-- CreateIndex
CREATE INDEX "manual_overrides_shop_id_idx" ON "manual_overrides"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "manual_overrides_shop_id_scope_type_scope_value_variant_id_key" ON "manual_overrides"("shop_id", "scope_type", "scope_value", "variant_id");

-- CreateIndex
CREATE INDEX "search_events_shop_id_created_at_idx" ON "search_events"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "search_events_shop_id_query_idx" ON "search_events"("shop_id", "query");

-- CreateIndex
CREATE INDEX "search_events_shop_id_variant_idx" ON "search_events"("shop_id", "variant");

-- CreateIndex
CREATE INDEX "bulk_operations_shop_id_idx" ON "bulk_operations"("shop_id");

-- CreateIndex
CREATE INDEX "bulk_operations_shopify_op_id_idx" ON "bulk_operations"("shopify_op_id");

-- CreateIndex
CREATE INDEX "webhook_logs_shop_domain_topic_idx" ON "webhook_logs"("shop_domain", "topic");

-- CreateIndex
CREATE INDEX "webhook_logs_webhook_id_idx" ON "webhook_logs"("webhook_id");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_overrides" ADD CONSTRAINT "manual_overrides_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create full-text search index
CREATE INDEX idx_product_variants_fts ON product_variants
USING gin(to_tsvector('english', canonical_text || ' ' || title || ' ' || COALESCE(vendor, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(variant_title, '')));

-- Create vector similarity index
CREATE INDEX idx_product_variants_embedding ON product_variants
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
