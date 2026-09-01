-- migration.sql · Tabla de configuración en BD (bi_config) · B3
-- Producto 006 · BI v2 · Admin IA · 2026-09-01
-- Parámetros clave/valor editables sin despliegue (modelos Ollama, timeouts,
-- umbrales). Los consume src/lib/config.ts (getConfig/setConfig).
-- ADITIVA: solo CREATE, jamás DROP ni ALTER destructivo.
-- Corre limpia sobre el schema inicial (20260901000000_catalogo_bi_inicial).

-- CreateTable
CREATE TABLE "bi_config" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bi_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bi_config_clave_key" ON "bi_config"("clave");
