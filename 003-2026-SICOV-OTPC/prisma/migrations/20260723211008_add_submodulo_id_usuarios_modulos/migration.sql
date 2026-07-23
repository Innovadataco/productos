-- ============================================================================
-- Migración 009 — columna aditiva usm_submodulo_id + unicidad por índices PARCIALES (B1)
-- REVISADA A MANO (gate ZEUS-003 / radicado 003-SICOV-006). --create-only + edición manual.
-- pg_dump previo obligatorio. Aditiva y no destructiva sobre datos (la columna es nueva).
-- ============================================================================

-- DropIndex: el unique viejo (usm_usuario_id, usm_modulo_id) se retira; lo reemplazan los
-- dos índices únicos PARCIALES de abajo (B1).
DROP INDEX "sicov"."tbl_usuarios_modulos_usm_usuario_id_usm_modulo_id_key";

-- AlterTable: columna aditiva nullable. NULL = módulo completo; no nulo = submódulo puntual.
ALTER TABLE "sicov"."tbl_usuarios_modulos" ADD COLUMN     "usm_submodulo_id" INTEGER;

-- CreateIndex: índice de apoyo para la FK / consultas por submódulo.
CREATE INDEX "tbl_usuarios_modulos_usm_submodulo_id_idx" ON "sicov"."tbl_usuarios_modulos"("usm_submodulo_id");

-- AddForeignKey
ALTER TABLE "sicov"."tbl_usuarios_modulos" ADD CONSTRAINT "tbl_usuarios_modulos_usm_submodulo_id_fkey" FOREIGN KEY ("usm_submodulo_id") REFERENCES "sicov"."tbl_submodulos"("smod_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── B1 (EDICIÓN MANUAL) ─────────────────────────────────────────────────────
-- Unicidad del permiso con DOS índices únicos PARCIALES. Necesario porque en PostgreSQL
-- los NULL son DISTINTOS entre sí en un índice único: un unique de (usuario, modulo, submodulo)
-- admitiría dos filas (u, m, NULL) y se perdería la garantía de "una sola fila de módulo
-- completo por usuario". No usamos UNIQUE NULLS NOT DISTINCT (dependiente de versión).
--   1) módulo completo: a lo sumo UNA fila (usuario, modulo) con submódulo NULL.
CREATE UNIQUE INDEX "ux_usmod_completo"  ON "sicov"."tbl_usuarios_modulos" ("usm_usuario_id", "usm_modulo_id")                     WHERE "usm_submodulo_id" IS NULL;
--   2) submódulo puntual: a lo sumo UNA fila por (usuario, modulo, submodulo) no nulo.
CREATE UNIQUE INDEX "ux_usmod_submodulo" ON "sicov"."tbl_usuarios_modulos" ("usm_usuario_id", "usm_modulo_id", "usm_submodulo_id") WHERE "usm_submodulo_id" IS NOT NULL;
