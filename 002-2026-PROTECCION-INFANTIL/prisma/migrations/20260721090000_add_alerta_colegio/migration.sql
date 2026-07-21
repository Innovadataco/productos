-- Add enum values for school alert audit actions
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ALERTA_CREADA';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ALERTA_ESTADO';

-- Track last generic school alert notification per school admin
ALTER TABLE "Usuario" ADD COLUMN "ultimaNotificacionColegioEn" TIMESTAMP(3);

-- Create school alert table
CREATE TABLE "AlertaColegio" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "identificadorAlumnoId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'nueva',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertaColegio_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_colegioId_fkey"
    FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_reporteId_fkey"
    FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_identificadorAlumnoId_fkey"
    FOREIGN KEY ("identificadorAlumnoId") REFERENCES "IdentificadorAlumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unique index to avoid duplicate alerts per school+report+identifier
CREATE UNIQUE INDEX "AlertaColegio_colegioId_reporteId_identificadorAlumnoId_key"
    ON "AlertaColegio"("colegioId", "reporteId", "identificadorAlumnoId");

-- Indexes for listing and filtering
CREATE INDEX "AlertaColegio_colegioId_estado_idx" ON "AlertaColegio"("colegioId", "estado");
CREATE INDEX "AlertaColegio_reporteId_idx" ON "AlertaColegio"("reporteId");
