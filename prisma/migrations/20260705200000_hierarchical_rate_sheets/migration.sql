-- Migration: hierarchical_rate_sheets
-- Adds per-level "available revenue" grants (OWNER / MANAGER). When a sheet
-- resolves for a sale, the commission slices are derived down the chain.

-- CreateEnum
CREATE TYPE "RateSheetLevel" AS ENUM ('OWNER', 'MANAGER');

-- CreateTable
CREATE TABLE "rate_sheets" (
    "id" TEXT NOT NULL,
    "level" "RateSheetLevel" NOT NULL,
    "principal_id" TEXT NOT NULL,
    "carrier_id" TEXT,
    "product_id" TEXT,
    "available_revenue" DOUBLE PRECISION NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_sheets_level_idx" ON "rate_sheets"("level");
CREATE INDEX "rate_sheets_principal_id_idx" ON "rate_sheets"("principal_id");
CREATE INDEX "rate_sheets_active_idx" ON "rate_sheets"("active");
CREATE INDEX "rate_sheets_effective_date_idx" ON "rate_sheets"("effective_date");

-- AddForeignKey
ALTER TABLE "rate_sheets" ADD CONSTRAINT "rate_sheets_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rate_sheets" ADD CONSTRAINT "rate_sheets_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rate_sheets" ADD CONSTRAINT "rate_sheets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
