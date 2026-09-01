-- migration.sql · Catálogo BI + log de consultas + cache semántico
-- Producto 006 · BI v2 · SPEC-006 · F3C 2026-09-01
-- Portada de 005 (BI v1 · 20260828120000_schema_catalogo_bi_inicial) sin
-- cambios de DDL. ADITIVA: solo CREATE, jamás DROP ni ALTER destructivo.
-- Corre limpia en PostgreSQL 16 VACÍA con extensión vector disponible (T4).
-- Las vistas materializadas `mv_fact_*` NO van aquí: referencian tablas
-- replicadas de PI (pg_logical) y las crea el script de activación de réplica.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "bi_catalogo_tabla" (
    "id" TEXT NOT NULL,
    "nombreFuente" TEXT NOT NULL,
    "nombreLegible" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "rolesPermitidos" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bi_catalogo_tabla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_catalogo_columna" (
    "id" TEXT NOT NULL,
    "tablaId" TEXT NOT NULL,
    "nombreFuente" TEXT NOT NULL,
    "nombreLegible" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL,
    "sinonimos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excluida" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_catalogo_columna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_catalogo_metrica" (
    "id" TEXT NOT NULL,
    "tablaId" TEXT,
    "nombre" TEXT NOT NULL,
    "nombreLegible" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "formulaSQL" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'general',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_catalogo_metrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_catalogo_ejemplo" (
    "id" TEXT NOT NULL,
    "tablaId" TEXT,
    "preguntaNL" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "categoriaConsulta" TEXT NOT NULL DEFAULT 'general',
    "verificado" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_catalogo_ejemplo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_consulta_log" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "preguntaNL" TEXT NOT NULL,
    "sqlGenerado" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "latenciaMs" INTEGER,
    "fuenteCache" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_consulta_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_cache_semantico" (
    "id" TEXT NOT NULL,
    "preguntaNL" TEXT NOT NULL,
    "sqlAprobado" TEXT NOT NULL,
    "aprobadoPor" TEXT NOT NULL DEFAULT 'human',
    "consultaLogId" TEXT,
    "embeddingPregunta" vector(768),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bi_cache_semantico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bi_catalogo_tabla_nombreFuente_key" ON "bi_catalogo_tabla"("nombreFuente");

-- CreateIndex
CREATE UNIQUE INDEX "bi_catalogo_columna_tablaId_nombreFuente_key" ON "bi_catalogo_columna"("tablaId", "nombreFuente");

-- CreateIndex
CREATE UNIQUE INDEX "bi_catalogo_metrica_nombre_key" ON "bi_catalogo_metrica"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "bi_catalogo_ejemplo_preguntaNL_key" ON "bi_catalogo_ejemplo"("preguntaNL");

-- CreateIndex
CREATE INDEX "bi_consulta_log_usuarioId_creadoEn_idx" ON "bi_consulta_log"("usuarioId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "bi_cache_semantico_preguntaNL_key" ON "bi_cache_semantico"("preguntaNL");

-- CreateIndex
CREATE UNIQUE INDEX "bi_cache_semantico_consultaLogId_key" ON "bi_cache_semantico"("consultaLogId");

-- AddForeignKey
ALTER TABLE "bi_catalogo_columna" ADD CONSTRAINT "bi_catalogo_columna_tablaId_fkey" FOREIGN KEY ("tablaId") REFERENCES "bi_catalogo_tabla"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_catalogo_metrica" ADD CONSTRAINT "bi_catalogo_metrica_tablaId_fkey" FOREIGN KEY ("tablaId") REFERENCES "bi_catalogo_tabla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_catalogo_ejemplo" ADD CONSTRAINT "bi_catalogo_ejemplo_tablaId_fkey" FOREIGN KEY ("tablaId") REFERENCES "bi_catalogo_tabla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bi_cache_semantico" ADD CONSTRAINT "bi_cache_semantico_consultaLogId_fkey" FOREIGN KEY ("consultaLogId") REFERENCES "bi_consulta_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice HNSW para búsqueda semántica en el cache (candado 7 · ratchet A-45)
CREATE INDEX "bi_cache_semantico_embeddingPregunta_idx" ON "bi_cache_semantico" USING hnsw ("embeddingPregunta" vector_cosine_ops);
