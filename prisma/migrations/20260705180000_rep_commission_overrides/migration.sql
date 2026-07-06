-- Migration: rep_commission_overrides
-- Adds custom per-rep (optionally per-product / per-carrier) flat commission
-- overrides, and an audit link from commission_records to the applied override.

-- CreateTable
CREATE TABLE "rep_commission_overrides" (
    "id" TEXT NOT NULL,
    "rep_id" TEXT NOT NULL,
    "carrier_id" TEXT,
    "product_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rep_commission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rep_commission_overrides_rep_id_idx" ON "rep_commission_overrides"("rep_id");
CREATE INDEX "rep_commission_overrides_active_idx" ON "rep_commission_overrides"("active");
CREATE INDEX "rep_commission_overrides_effective_date_idx" ON "rep_commission_overrides"("effective_date");

-- AlterTable
ALTER TABLE "commission_records" ADD COLUMN "rep_commission_override_id" TEXT;

-- AddForeignKey
ALTER TABLE "rep_commission_overrides" ADD CONSTRAINT "rep_commission_overrides_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rep_commission_overrides" ADD CONSTRAINT "rep_commission_overrides_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rep_commission_overrides" ADD CONSTRAINT "rep_commission_overrides_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_rep_commission_override_id_fkey" FOREIGN KEY ("rep_commission_override_id") REFERENCES "rep_commission_overrides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
