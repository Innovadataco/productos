-- SPEC-160 (002-PI-059): tabla de marcado quirúrgico para datos demo en producción.
-- Migración ADITIVA: solo CREATE TABLE + índices. Sin DROP.

CREATE TABLE "demo_marcado" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_marcado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demo_marcado_entidad_entidadId_key" ON "demo_marcado"("entidad", "entidadId");
CREATE INDEX "demo_marcado_entidad_idx" ON "demo_marcado"("entidad");
CREATE INDEX "demo_marcado_entidadId_idx" ON "demo_marcado"("entidadId");
