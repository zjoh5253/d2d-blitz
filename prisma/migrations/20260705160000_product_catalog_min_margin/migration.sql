-- Migration: product_catalog_min_margin
-- Adds a per-carrier product catalog with per-product revenue, threads an optional
-- product through sales / rate sheets / commissions, and adds a carrier-level
-- minimum retained margin (enforced at rate-sheet save time in the app layer).

-- AlterTable
ALTER TABLE "carriers" ADD COLUMN "min_margin_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "min_margin_percent" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_carrier_id_idx" ON "products"("carrier_id");
CREATE INDEX "products_active_idx" ON "products"("active");

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "product_id" TEXT;
CREATE INDEX "sales_product_id_idx" ON "sales"("product_id");

-- AlterTable
ALTER TABLE "stack_configs" ADD COLUMN "product_id" TEXT;
CREATE INDEX "stack_configs_product_id_idx" ON "stack_configs"("product_id");

-- AlterTable
ALTER TABLE "commission_records" ADD COLUMN "product_id" TEXT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stack_configs" ADD CONSTRAINT "stack_configs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
