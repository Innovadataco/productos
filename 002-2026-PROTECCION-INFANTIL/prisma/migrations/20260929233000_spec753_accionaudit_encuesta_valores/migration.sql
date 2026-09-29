-- SPEC-753 · Agrega al tipo "AccionAudit" los dos valores del HECHO del cruce de
-- encuestas, que el artefacto de esquema declaró (schema.prisma) pero ninguna migración
-- construía en la base — la deriva que cazó historial:check (SPEC-746).
--
-- ADITIVO y NO destructivo: ADD VALUE IF NOT EXISTS no recrea el enum (Prisma proponía
-- recrearlo entero; eso NO es lo que hay que hacer). Los valores solo se DECLARAN acá; no
-- se USAN en esta migración — Postgres prohíbe usar un valor de enum en la misma
-- transacción que lo agrega, así que si algún día una migración además los referencia,
-- va en un archivo aparte.
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ENCUESTA_CITA_RESPONDIDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ENCUESTA_CITA_CONTRADICCION';
