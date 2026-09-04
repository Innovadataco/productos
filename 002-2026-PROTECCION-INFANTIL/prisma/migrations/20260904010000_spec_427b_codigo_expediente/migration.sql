-- SPEC-427b (A-75 · L6 · brief §9 momento 6) — el código de expediente, de
-- punta a punta. Salió de 427 porque estaba a medias; acá se completa.
--
-- Solo dos valores de enum: el modelo `CodigoCita` y su tipo `EXPEDIENTE` ya
-- existen desde 427. Lección I-277: el valor de enum y el código que lo emite
-- viajan en la MISMA migración — ambos se usan en este PR (nadie los tenía en
-- 427, justamente para no dejar un enum sin emisor).
--
-- BI · bi_replica: `AuditLog` está en la publicación. Kimi ya aplicó los 7
-- valores (los 5 de 427 + estos 2) con ADD VALUE IF NOT EXISTS y los dejó en su
-- script de reconciliación (verificado 2026-09-04, 45/45 tablas en 'r').
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CODIGO_DIGITADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_EXPEDIENTE_ABIERTO';
