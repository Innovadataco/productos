-- SPEC-159: modelos "SeguimientoCaso" y "NotaSeguimiento" (seguimiento del caso
-- del colegio: bitácora 1:1 con la alerta + notas inmutables) + 1 valor aditivo
-- en enum "AccionAudit" (ALTER TYPE ... ADD VALUE, PG16). Migración 100%
-- aditiva. I-49: el diff crudo de `migrate diff` traía los DROP INDEX del drift
-- (AlertaColegio_patronInstitucionalId_idx, Ciudad_nombreNormalizado_trgm_idx,
-- EmbeddingDataset_vector_idx, EmbeddingReporte_vector_idx), un RENAME INDEX
-- por nombre truncado en patrones_institucionales y un CREATE EXTENSION
-- "vector" (ya existe en la BD real) — NINGUNO se aplica aquí: esos objetos
-- viven solo en la BD real y NO se tocan (mismo drift documentado en la
-- migración 20260809060000_avisos_colegio). Leído línea a línea antes de
-- aplicar. Cuidado ADD VALUE (ZEUS): el valor nuevo del enum NO se usa en esta
-- migración (el seed no lo necesita).

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CASO_NOTA_AGREGADA';

-- CreateTable
CREATE TABLE "SeguimientoCaso" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "alertaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'en_seguimiento',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeguimientoCaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaSeguimiento" (
    "id" TEXT NOT NULL,
    "seguimientoId" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaSeguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeguimientoCaso_alertaId_key" ON "SeguimientoCaso"("alertaId");

-- CreateIndex
CREATE INDEX "SeguimientoCaso_colegioId_estado_idx" ON "SeguimientoCaso"("colegioId", "estado");

-- CreateIndex
CREATE INDEX "NotaSeguimiento_seguimientoId_creadoEn_idx" ON "NotaSeguimiento"("seguimientoId", "creadoEn");

-- AddForeignKey
ALTER TABLE "SeguimientoCaso" ADD CONSTRAINT "SeguimientoCaso_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeguimientoCaso" ADD CONSTRAINT "SeguimientoCaso_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "AlertaColegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSeguimiento" ADD CONSTRAINT "NotaSeguimiento_seguimientoId_fkey" FOREIGN KEY ("seguimientoId") REFERENCES "SeguimientoCaso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSeguimiento" ADD CONSTRAINT "NotaSeguimiento_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaSeguimiento" ADD CONSTRAINT "NotaSeguimiento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
