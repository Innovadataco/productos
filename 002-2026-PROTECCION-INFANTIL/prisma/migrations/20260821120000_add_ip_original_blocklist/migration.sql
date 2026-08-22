-- Add ipOriginal to BlockList (I-94): persist the plain IP entered by admin for display in the operative dashboard.
-- Consistente con el resto de columnas de block_list (camelCase por legado de SPEC-184).
ALTER TABLE "block_list" ADD COLUMN "ipOriginal" TEXT;
