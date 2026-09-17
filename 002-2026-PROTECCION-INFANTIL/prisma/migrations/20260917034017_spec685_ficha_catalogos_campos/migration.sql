-- SPEC-685 · Ficha del profesional con catálogo cerrado — fase ADD.
--
-- Escrita a mano (NO `prisma migrate dev`): el esquema de este repo usa features por
-- SQL crudo que Prisma no modela (índices parciales/trgm/pgvector, timestamptz), así
-- que `migrate dev` genera una migración DESTRUCTIVA de deriva (dropea esos índices y
-- cambia timestamptz→timestamp). CI aplica con `migrate deploy` (forward-only), a la
-- que esta migración —solo ADD COLUMN— es segura.
--
-- Reemplazan a `tituloProfesional` (→ profesion) y `especialidades` (→ areasAtencion);
-- `rangoEtario` es nuevo (múltiple). El DROP de las viejas va en un PR aparte (split
-- ADD/DROP). Los arreglos con DEFAULT '{}' para que las filas existentes queden en []
-- (misma convención que `especialidades`); `profesion` nulo = «sin elegir todavía».
ALTER TABLE "PerfilProfesional"
    ADD COLUMN "profesion" TEXT,
    ADD COLUMN "areasAtencion" TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN "rangoEtario" TEXT[] NOT NULL DEFAULT '{}';
