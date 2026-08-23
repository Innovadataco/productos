-- SPEC-212 (002-PI-112): cambios aditivos al módulo de pagos.
-- Cero DROP COLUMN / DROP TABLE / DROP TYPE.

-- Agrega el estado REEMBOLSADO al enum existente.
ALTER TYPE "EstadoPago" ADD VALUE 'REEMBOLSADO';

-- Agrega campos de reembolso al modelo Pago.
ALTER TABLE "Pago"
    ADD COLUMN "montoReembolsoUSD" DOUBLE PRECISION,
    ADD COLUMN "motivoReembolso" TEXT,
    ADD COLUMN "referenciaReembolso" TEXT;
