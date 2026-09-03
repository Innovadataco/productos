-- I-277: valores del enum AccionAudit que faltaban.
-- `asignarAlerta` y `escalarAlerta` los usaban con `as AccionAudit` — Prisma
-- validaba en runtime y tronaba con 500. Se agregan y se quitan los casts.
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COLEGIO_ALERTA_ASIGNADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COLEGIO_ALERTA_ESCALADA';
