-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "CategoriaConducta" AS ENUM ('CONTACTO_INSISTENTE', 'SOLICITUD_MATERIAL', 'OFRECIMIENTO_REGALOS', 'SUPLANTACION_IDENTIDAD', 'SOLICITUD_ENCUENTRO', 'COMPARTIMIENTO_SEXUAL', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoReporte" AS ENUM ('PENDIENTE', 'PROCESANDO', 'CLASIFICADO', 'REVISION_MANUAL', 'POSIBLE_SPAM', 'DUPLICADO', 'REQUIERE_ANONIMIZACION', 'CORREGIDO');

-- CreateTable
CREATE TABLE "Plataforma" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'otro',
    "esActiva" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reporte" (
    "id" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "plataformaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "textoOriginal" TEXT,
    "fechaIncidente" TIMESTAMP(3) NOT NULL,
    "ciudad" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "estado" "EstadoReporte" NOT NULL DEFAULT 'PENDIENTE',
    "esAnonimo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" TEXT,
    "reporteOrigenId" TEXT,
    "numeroSeguimiento" TEXT,
    "tenantId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentificadorReportado" (
    "id" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "plataformaId" TEXT NOT NULL,
    "totalReportes" INTEGER NOT NULL DEFAULT 0,
    "reportesAutenticados" INTEGER NOT NULL DEFAULT 0,
    "reportesAnonimos" INTEGER NOT NULL DEFAULT 0,
    "esVisiblePublicamente" BOOLEAN NOT NULL DEFAULT false,
    "ultimoReporteEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentificadorReportado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClasificacionIA" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "categoria" "CategoriaConducta" NOT NULL,
    "confianza" DOUBLE PRECISION NOT NULL,
    "contienePii" BOOLEAN NOT NULL DEFAULT false,
    "piiDetectada" TEXT[],
    "modeloUsado" TEXT NOT NULL,
    "latenciaMs" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "responseTokens" INTEGER,
    "rawResponse" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClasificacionIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorreccionAdmin" (
    "id" TEXT NOT NULL,
    "clasificacionId" TEXT NOT NULL,
    "categoriaOriginal" "CategoriaConducta" NOT NULL,
    "categoriaCorregida" "CategoriaConducta" NOT NULL,
    "adminId" TEXT NOT NULL,
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorreccionAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetEntrenamiento" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "clasificacionCorrecta" "CategoriaConducta" NOT NULL,
    "fuente" TEXT NOT NULL,
    "correccionId" TEXT,
    "usadoParaEntrenamiento" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetEntrenamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddingReporte" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "vector" vector(768) NOT NULL,
    "modeloUsado" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingReporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plataforma_clave_key" ON "Plataforma"("clave");

-- CreateIndex
CREATE INDEX "Plataforma_clave_idx" ON "Plataforma"("clave");

-- CreateIndex
CREATE INDEX "Plataforma_esActiva_idx" ON "Plataforma"("esActiva");

-- CreateIndex
CREATE UNIQUE INDEX "Reporte_numeroSeguimiento_key" ON "Reporte"("numeroSeguimiento");

-- CreateIndex
CREATE INDEX "Reporte_identificador_plataformaId_idx" ON "Reporte"("identificador", "plataformaId");

-- CreateIndex
CREATE INDEX "Reporte_estado_idx" ON "Reporte"("estado");

-- CreateIndex
CREATE INDEX "Reporte_usuarioId_identificador_idx" ON "Reporte"("usuarioId", "identificador");

-- CreateIndex
CREATE INDEX "Reporte_creadoEn_idx" ON "Reporte"("creadoEn");

-- CreateIndex
CREATE INDEX "Reporte_numeroSeguimiento_idx" ON "Reporte"("numeroSeguimiento");

-- CreateIndex
CREATE INDEX "IdentificadorReportado_esVisiblePublicamente_idx" ON "IdentificadorReportado"("esVisiblePublicamente");

-- CreateIndex
CREATE INDEX "IdentificadorReportado_totalReportes_idx" ON "IdentificadorReportado"("totalReportes");

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorReportado_identificador_plataformaId_key" ON "IdentificadorReportado"("identificador", "plataformaId");

-- CreateIndex
CREATE UNIQUE INDEX "ClasificacionIA_reporteId_key" ON "ClasificacionIA"("reporteId");

-- CreateIndex
CREATE INDEX "ClasificacionIA_categoria_idx" ON "ClasificacionIA"("categoria");

-- CreateIndex
CREATE INDEX "ClasificacionIA_confianza_idx" ON "ClasificacionIA"("confianza");

-- CreateIndex
CREATE UNIQUE INDEX "CorreccionAdmin_clasificacionId_key" ON "CorreccionAdmin"("clasificacionId");

-- CreateIndex
CREATE INDEX "DatasetEntrenamiento_usadoParaEntrenamiento_idx" ON "DatasetEntrenamiento"("usadoParaEntrenamiento");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingReporte_reporteId_key" ON "EmbeddingReporte"("reporteId");

-- CreateIndex
CREATE INDEX "EmbeddingReporte_vector_idx" ON "EmbeddingReporte"("vector");

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_reporteOrigenId_fkey" FOREIGN KEY ("reporteOrigenId") REFERENCES "Reporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorReportado" ADD CONSTRAINT "IdentificadorReportado_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasificacionIA" ADD CONSTRAINT "ClasificacionIA_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorreccionAdmin" ADD CONSTRAINT "CorreccionAdmin_clasificacionId_fkey" FOREIGN KEY ("clasificacionId") REFERENCES "ClasificacionIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorreccionAdmin" ADD CONSTRAINT "CorreccionAdmin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetEntrenamiento" ADD CONSTRAINT "DatasetEntrenamiento_correccionId_fkey" FOREIGN KEY ("correccionId") REFERENCES "CorreccionAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddingReporte" ADD CONSTRAINT "EmbeddingReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
