-- SPEC-238 (002-PI-mega-cola): aclaración padre-comité (1 iteración máx).
-- Aditiva: solo ADD VALUE, CREATE TABLE, índices y FKs nuevas; ningún DROP
-- ni cambio destructivo.

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ACLARACION_SOLICITADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ACLARACION_RESPONDIDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ACLARACION_CERRADA_FORZOSAMENTE';

-- CreateTable
CREATE TABLE "aclaracion_expediente" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "informeConsolidadoId" TEXT NOT NULL,
    "solicitadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitudTexto" TEXT NOT NULL,
    "respondidaEn" TIMESTAMPTZ(6),
    "respondidaPor" TEXT,
    "respuestaTexto" TEXT,
    "estado" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aclaracion_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (máxima una aclaración por expediente, FR/edge case de la spec)
CREATE UNIQUE INDEX "aclaracion_expediente_expedienteId_key" ON "aclaracion_expediente"("expedienteId");

-- CreateIndex
CREATE INDEX "aclaracion_expediente_expedienteId_idx" ON "aclaracion_expediente"("expedienteId");

-- CreateIndex
CREATE INDEX "aclaracion_expediente_informeConsolidadoId_idx" ON "aclaracion_expediente"("informeConsolidadoId");

-- CreateIndex
CREATE INDEX "aclaracion_expediente_estado_idx" ON "aclaracion_expediente"("estado");

-- CreateIndex (barrido del worker: aclaraciones PENDIENTE por antigüedad)
CREATE INDEX "aclaracion_expediente_solicitadaEn_idx" ON "aclaracion_expediente"("solicitadaEn");

-- AddForeignKey
ALTER TABLE "aclaracion_expediente" ADD CONSTRAINT "aclaracion_expediente_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aclaracion_expediente" ADD CONSTRAINT "aclaracion_expediente_informeConsolidadoId_fkey" FOREIGN KEY ("informeConsolidadoId") REFERENCES "informes_consolidados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aclaracion_expediente" ADD CONSTRAINT "aclaracion_expediente_respondidaPor_fkey" FOREIGN KEY ("respondidaPor") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
