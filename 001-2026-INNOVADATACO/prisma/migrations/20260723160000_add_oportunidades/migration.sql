-- Oportunidades (spec 006): Licitación evoluciona a Oportunidad sin perder datos.
-- Orden SEGURO sobre datos vivos (R-01/R-02): crear -> sembrar -> backfill ->
-- relajar NOT NULL. Ensayado en BD desechable con conteo antes/después (SC-003).

-- 1) Catálogo configurable de tipos (FR-002)
CREATE TABLE "TipoOportunidad" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "nombreOficial" TEXT NOT NULL,
    "exigeNumero" BOOLEAN NOT NULL DEFAULT false,
    "exigeFechaApertura" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TipoOportunidad_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TipoOportunidad_key_key" ON "TipoOportunidad"("key");

-- 2) Presupuesto desglosado (FR-008)
CREATE TABLE "PartidaPresupuesto" (
    "id" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartidaPresupuesto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartidaPresupuesto_licitacionId_idx" ON "PartidaPresupuesto"("licitacionId");
ALTER TABLE "PartidaPresupuesto"
  ADD CONSTRAINT "PartidaPresupuesto_licitacionId_fkey"
  FOREIGN KEY ("licitacionId") REFERENCES "licitaciones"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Columnas nuevas en licitaciones (nullable: no rompen filas existentes)
ALTER TABLE "licitaciones"
  ADD COLUMN "tipoId" INTEGER,
  ADD COLUMN "ciudadEjecucion" TEXT,
  ADD COLUMN "fechaPliegosDefinitivos" TIMESTAMP(3),
  ADD COLUMN "fechaEntregaPropuesta" TIMESTAMP(3),
  ADD COLUMN "fechaAdjudicacion" TIMESTAMP(3),
  ADD COLUMN "fechaCierre" TIMESTAMP(3);
CREATE INDEX "licitaciones_tipoId_idx" ON "licitaciones"("tipoId");
ALTER TABLE "licitaciones"
  ADD CONSTRAINT "licitaciones_tipoId_fkey"
  FOREIGN KEY ("tipoId") REFERENCES "TipoOportunidad"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Info ampliada de la entidad (FR-010: aditiva y opcional)
ALTER TABLE "EntidadLicitacion"
  ADD COLUMN "nit" TEXT,
  ADD COLUMN "sitioWeb" TEXT,
  ADD COLUMN "telefono" TEXT,
  ADD COLUMN "direccion" TEXT,
  ADD COLUMN "ciudad" TEXT;

-- 5) Sembrar los 3 tipos DENTRO de la migración: el backfill de abajo necesita el id
--    de "licitación pública". El seed idempotente (seed.mjs) los deja igual después.
INSERT INTO "TipoOportunidad" ("key", "nombreOficial", "exigeNumero", "exigeFechaApertura", "updatedAt")
VALUES
  ('licitacion-publica',   'Licitación pública',   true,  true,  CURRENT_TIMESTAMP),
  ('concurso-meritos',     'Concurso de méritos',  false, false, CURRENT_TIMESTAMP),
  ('contratacion-directa', 'Contratación directa', false, false, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- 6) BACKFILL: toda oportunidad existente es una licitación pública (su naturaleza
--    actual). Conserva su numero y fechaApertura (FR-004).
UPDATE "licitaciones"
  SET "tipoId" = (SELECT "id" FROM "TipoOportunidad" WHERE "key" = 'licitacion-publica')
  WHERE "tipoId" IS NULL;

-- 7) SOLO AHORA (tras el backfill) se relaja el NOT NULL de numero y fechaApertura.
--    Antes no: perderíamos la señal de qué era obligatorio.
ALTER TABLE "licitaciones" ALTER COLUMN "numero" DROP NOT NULL;
ALTER TABLE "licitaciones" ALTER COLUMN "fechaApertura" DROP NOT NULL;
