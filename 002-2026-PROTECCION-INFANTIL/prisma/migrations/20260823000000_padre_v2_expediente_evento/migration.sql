-- CreateEnum
CREATE TYPE "EstadoExpediente" AS ENUM ('ACTIVO', 'CONSOLIDANDO', 'PENDIENTE_COMITE', 'EN_APROBACION_PADRE', 'EN_ACLARACION', 'CERRADO', 'ESCALADO');

-- CreateEnum
CREATE TYPE "ScoreGravedad" AS ENUM ('VERDE', 'AMARILLO', 'ROJO');

-- CreateEnum
CREATE TYPE "TipoRevisionComite" AS ENUM ('REVISION_REPORTE', 'CONSOLIDACION_EXPEDIENTE');

-- CreateTable
CREATE TABLE "Expediente" (
    "id" TEXT NOT NULL,
    "padreUsuarioId" TEXT NOT NULL,
    "identificadorReportado" TEXT NOT NULL,
    "plataformaId" TEXT,
    "fechaApertura" TIMESTAMPTZ(6) NOT NULL,
    "fechaCierre" TIMESTAMPTZ(6),
    "fechaEscalado" TIMESTAMPTZ(6),
    "estado" "EstadoExpediente" NOT NULL,
    "scoreGravedadActual" "ScoreGravedad" NOT NULL DEFAULT 'VERDE',
    "categoriasDominantesJson" JSONB,
    "numEventos" INTEGER NOT NULL DEFAULT 0,
    "ultimoEventoEn" TIMESTAMPTZ(6),
    "autoCerradoPorInactividad" BOOLEAN NOT NULL DEFAULT false,
    "expedienteRelacionadoAnteriorId" TEXT,
    "patronesDetectadosJson" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoExpediente" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "ordenSecuencial" INTEGER NOT NULL,
    "reporteId" TEXT,
    "fechaEvento" TIMESTAMPTZ(6) NOT NULL,
    "texto" TEXT NOT NULL,
    "categoriaDetectada" TEXT,
    "confianzaClasificacion" DOUBLE PRECISION,
    "plataforma" TEXT,
    "adjuntosMetaJson" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoExpediente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expediente_padreUsuarioId_estado_idx" ON "Expediente"("padreUsuarioId", "estado");

-- CreateIndex
CREATE INDEX "Expediente_identificadorReportado_idx" ON "Expediente"("identificadorReportado");

-- CreateIndex
CREATE INDEX "Expediente_estado_updatedAt_idx" ON "Expediente"("estado", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "EventoExpediente_expedienteId_fechaEvento_idx" ON "EventoExpediente"("expedienteId", "fechaEvento" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "EventoExpediente_expedienteId_ordenSecuencial_key" ON "EventoExpediente"("expedienteId", "ordenSecuencial");

-- AddForeignKey
ALTER TABLE "Expediente" ADD CONSTRAINT "Expediente_padreUsuarioId_fkey" FOREIGN KEY ("padreUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expediente" ADD CONSTRAINT "Expediente_expedienteRelacionadoAnteriorId_fkey" FOREIGN KEY ("expedienteRelacionadoAnteriorId") REFERENCES "Expediente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoExpediente" ADD CONSTRAINT "EventoExpediente_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoExpediente" ADD CONSTRAINT "EventoExpediente_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

