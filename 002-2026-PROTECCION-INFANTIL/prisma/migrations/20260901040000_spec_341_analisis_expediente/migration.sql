-- SPEC-341 (A-68 §4.4 capa 2 · Fase 2) · el análisis IA en fila del expediente.
-- ADITIVA: solo agrega dos enums, una tabla nueva y sus índices. No toca
-- ninguna tabla existente (Expediente ni GuiaAccionCategoria ganan solo
-- back-relations Prisma que no requieren DDL).

-- 1. Enums nuevos.
CREATE TYPE "AlcanceAnalisis" AS ENUM ('PADRE_COMPLETO', 'COLEGIO_BLINDADO');
CREATE TYPE "EstadoAnalisis" AS ENUM ('GENERANDO', 'PUBLICADO', 'FALLIDO');

-- 2. Tabla del análisis. Inmutable post-publicado a nivel aplicación (DAL sin
--    update ni delete públicos); cascada por baja del expediente (Ley 1581).
CREATE TABLE "AnalisisExpediente" (
    "id"                 TEXT NOT NULL,
    "expedienteId"       TEXT NOT NULL,
    "versionSecuencial"  INTEGER NOT NULL,
    "alcance"            "AlcanceAnalisis" NOT NULL,
    "hashCadena"         TEXT NOT NULL,
    "corteN"             INTEGER NOT NULL,
    "texto"              TEXT NOT NULL,
    "categoriaDominante" "CategoriaConducta",
    "guiaAccionId"       TEXT,
    "modeloUsado"        TEXT NOT NULL,
    "promptSistemaHash"  TEXT NOT NULL,
    "latenciaMs"         INTEGER NOT NULL,
    "estado"             "EstadoAnalisis" NOT NULL DEFAULT 'GENERANDO',
    "motivoFallo"        TEXT,
    "generadoEn"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoEn"        TIMESTAMPTZ(6),

    CONSTRAINT "AnalisisExpediente_pkey" PRIMARY KEY ("id")
);

-- 3. FKs: expediente en cascada (§4.3 · borrado por Ley 1581 se lleva sus
--    análisis); guía de acción SET NULL (una guía puede ser archivada y las
--    lecturas históricas del padre siguen mostrando el texto).
ALTER TABLE "AnalisisExpediente"
    ADD CONSTRAINT "AnalisisExpediente_expedienteId_fkey"
    FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalisisExpediente"
    ADD CONSTRAINT "AnalisisExpediente_guiaAccionId_fkey"
    FOREIGN KEY ("guiaAccionId") REFERENCES "GuiaAccionCategoria"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Índices — versionSecuencial único por expediente; búsqueda del vigente,
--    del hash coincidente y de la cola del panel admin.
CREATE UNIQUE INDEX "AnalisisExpediente_expedienteId_versionSecuencial_key"
    ON "AnalisisExpediente"("expedienteId", "versionSecuencial");
CREATE INDEX "AnalisisExpediente_expedienteId_estado_idx"
    ON "AnalisisExpediente"("expedienteId", "estado");
CREATE INDEX "AnalisisExpediente_expedienteId_hashCadena_estado_idx"
    ON "AnalisisExpediente"("expedienteId", "hashCadena", "estado");
CREATE INDEX "AnalisisExpediente_expedienteId_versionSecuencial_desc_idx"
    ON "AnalisisExpediente"("expedienteId", "versionSecuencial" DESC);
CREATE INDEX "AnalisisExpediente_estado_generadoEn_idx"
    ON "AnalisisExpediente"("estado", "generadoEn");
