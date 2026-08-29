-- SPEC-149: modelos "PreferenciaAlertaColegio" y "RegistroAvisoColegio"
-- (avisos por email del colegio: preferencias por tipo de evento + bitácora de
-- idempotencia por constraint) + 2 valores aditivos en enum "AccionAudit"
-- (ALTER TYPE ... ADD VALUE, PG16). Migración 100% aditiva. I-49: el diff crudo
-- de `migrate diff` traía los DROP INDEX del drift
-- (AlertaColegio_patronInstitucionalId_idx, Ciudad_nombreNormalizado_trgm_idx,
-- EmbeddingDataset_vector_idx, EmbeddingReporte_vector_idx), un RENAME INDEX
-- por nombre truncado en patrones_institucionales y un CREATE EXTENSION
-- "vector" (ya existe en la BD real) — NINGUNO se aplica aquí: esos objetos
-- viven solo en la BD real y NO se tocan. Leído línea a línea antes de aplicar.
-- Cuidado ADD VALUE (ZEUS): los valores nuevos del enum NO se usan en esta
-- migración (el seed no los necesita).

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_AVISO_ENVIADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_AVISO_PREFERENCIA_ACTUALIZADA';

-- CreateTable
CREATE TABLE "PreferenciaAlertaColegio" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "emailDestino" TEXT,
    "umbral" INTEGER,
    "ventanaDias" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenciaAlertaColegio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAvisoColegio" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "estado" TEXT NOT NULL,
    "detalle" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroAvisoColegio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreferenciaAlertaColegio_colegioId_tipoEvento_key" ON "PreferenciaAlertaColegio"("colegioId", "tipoEvento");

-- CreateIndex
CREATE INDEX "RegistroAvisoColegio_colegioId_estado_idx" ON "RegistroAvisoColegio"("colegioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAvisoColegio_colegioId_tipoEvento_entidadId_dia_key" ON "RegistroAvisoColegio"("colegioId", "tipoEvento", "entidadId", "dia");

-- AddForeignKey
ALTER TABLE "PreferenciaAlertaColegio" ADD CONSTRAINT "PreferenciaAlertaColegio_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAvisoColegio" ADD CONSTRAINT "RegistroAvisoColegio_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
