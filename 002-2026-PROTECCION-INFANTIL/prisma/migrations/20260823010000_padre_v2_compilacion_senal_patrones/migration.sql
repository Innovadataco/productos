-- SPEC-234 (002-PI-134): modelos de compilación técnica, señal comunitaria y patrones N1.
-- Migración aditiva: solo CREATE TYPE / CREATE TABLE / CREATE INDEX / ADD FOREIGN KEY.

-- CreateEnum
CREATE TYPE "TipoPatronExpediente" AS ENUM ('ACELERACION', 'PROGRESION', 'PERPETRADOR_SERIAL', 'MULTIPLATAFORMA');

-- CreateTable
CREATE TABLE "informes_consolidados" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "versionSecuencial" INTEGER NOT NULL,
    "scoreValor" DOUBLE PRECISION NOT NULL,
    "scoreGravedad" "ScoreGravedad" NOT NULL,
    "categoriasDetectadasJson" JSONB NOT NULL,
    "patronesDetectadosJson" JSONB,
    "senalComunitariaJson" JSONB,
    "resumenTextoGenerado" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "pdfHash" TEXT,
    "pdfGeneradoEn" TIMESTAMPTZ(6),
    "generadoPorId" TEXT,
    "tipoRevision" "TipoRevisionComite" NOT NULL DEFAULT 'CONSOLIDACION_EXPEDIENTE',
    "guiaAccionCategoriaIdPrincipal" TEXT,
    "estadoAprobacion" TEXT NOT NULL DEFAULT 'PENDIENTE_COMITE',
    "aprobadoPorMiembrosJson" JSONB,
    "correccionesJson" JSONB,
    "nivelConfianza" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "informes_consolidados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senal_comunitaria_cache" (
    "identificadorReportado" TEXT NOT NULL,
    "totalExpedientesActivos" INTEGER NOT NULL DEFAULT 0,
    "totalExpedientesCerrados" INTEGER NOT NULL DEFAULT 0,
    "totalExpedientesEscalados" INTEGER NOT NULL DEFAULT 0,
    "categoriasFrecuenciaJson" JSONB NOT NULL,
    "primeraAparicionEn" TIMESTAMPTZ(6) NOT NULL,
    "ultimaAparicionEn" TIMESTAMPTZ(6) NOT NULL,
    "paisesJson" JSONB NOT NULL,
    "ciudadesJson" JSONB NOT NULL,
    "plataformasJson" JSONB NOT NULL,
    "invalidado" BOOLEAN NOT NULL DEFAULT false,
    "actualizadoEn" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "senal_comunitaria_cache_pkey" PRIMARY KEY ("identificadorReportado")
);

-- CreateTable
CREATE TABLE "patrones_expediente" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "tipoPatron" "TipoPatronExpediente" NOT NULL,
    "severidad" TEXT NOT NULL,
    "nivelConfianza" DOUBLE PRECISION NOT NULL,
    "descripcionTexto" TEXT NOT NULL,
    "datosContextoJson" JSONB NOT NULL,
    "detectadoEn" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patrones_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "informes_consolidados_pdfHash_key" ON "informes_consolidados"("pdfHash");

-- CreateIndex
CREATE INDEX "informes_consolidados_expedienteId_createdAt_idx" ON "informes_consolidados"("expedienteId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "informes_consolidados_expedienteId_versionSecuencial_key" ON "informes_consolidados"("expedienteId", "versionSecuencial");

-- CreateIndex
CREATE INDEX "senal_comunitaria_cache_ultimaAparicionEn_idx" ON "senal_comunitaria_cache"("ultimaAparicionEn" DESC);

-- CreateIndex
CREATE INDEX "patrones_expediente_expedienteId_severidad_idx" ON "patrones_expediente"("expedienteId", "severidad");

-- CreateIndex
CREATE INDEX "patrones_expediente_expedienteId_tipoPatron_idx" ON "patrones_expediente"("expedienteId", "tipoPatron");

-- AddForeignKey
ALTER TABLE "informes_consolidados" ADD CONSTRAINT "informes_consolidados_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informes_consolidados" ADD CONSTRAINT "informes_consolidados_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrones_expediente" ADD CONSTRAINT "patrones_expediente_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
