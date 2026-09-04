-- 08-bi-db-reconciliar-drift.sql · Reconciliación ADITIVA del esquema suscriptor (bi-db)
-- Producto 006 · BI v2 · 2026-09-03
--
-- Contexto: la réplica lógica exige que el suscriptor tenga TODAS las columnas
-- publicadas y TODOS los valores de enum que el publicador emite. Cuando PI
-- agrega columnas/valores y bi-db se queda atrás, los workers de sync fallan
-- con "missing replicated column" / "invalid input value for enum" y la tabla
-- se queda atascada en srsubstate='d' para siempre.
--
-- Este script es IDEMPOTENTE y ADITIVO: solo agrega lo que falta, nunca borra
-- ni modifica. Correr en bi-db tras detectar drift (ver 04-verificar-replica.sql).
--
-- Hallazgo real corregido el 2026-09-03 (bloqueó AlertaColegio, AuditLog,
-- ClasificacionIA y SolicitudComite): 7 columnas nuevas en PI + 22 valores
-- del enum AccionAudit que bi-db no tenía.

-- Columnas nuevas de PI que faltaban en bi-db (todas nullable, sin PII)
ALTER TABLE "AlertaColegio" ADD COLUMN IF NOT EXISTS "identificadorIntegranteComiteId" text;
ALTER TABLE "ClasificacionIA" ADD COLUMN IF NOT EXISTS "overrideModeloUsado" text;
ALTER TABLE "SolicitudComite" ADD COLUMN IF NOT EXISTS "analisis" text;
ALTER TABLE "SolicitudComite" ADD COLUMN IF NOT EXISTS "analisisActualizadoEn" timestamp without time zone;
ALTER TABLE "SolicitudComite" ADD COLUMN IF NOT EXISTS "analisisPorId" text;
ALTER TABLE "SolicitudComite" ADD COLUMN IF NOT EXISTS "recomendacionInformeEn" timestamp without time zone;
ALTER TABLE "SolicitudComite" ADD COLUMN IF NOT EXISTS "recomendacionPorId" text;

-- Valores del enum AccionAudit que PI emite y bi-db desconocía (22 valores,
-- detectados por diff pg_enum publicador vs suscriptor el 2026-09-03).
-- NOTA: ALTER TYPE ADD VALUE no corre dentro de una transacción; psql -c/-f
-- lo ejecuta por comando individual, que es seguro.
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_ALARMA_TASA_VENCIMIENTOS';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_AVISO_48H_ENVIADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CONFIRMADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_PAGO_APROBADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_PAGO_EXPIRADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_REASIGNADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_RECHAZADA_PROFESIONAL';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_REPROGRAMADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_SUSPENDIDO_POR_VENCIMIENTOS';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_VENCIDA_PROFESIONAL';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COLEGIO_ALERTA_ASIGNADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COLEGIO_ALERTA_ESCALADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COLEGIO_CURSO_MATERIA_ACTUALIZADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COMITE_ANALISIS_ACTUALIZADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COMITE_RECOMENDACION_INFORME';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PROFESIONAL_AUTORIZACION_ACCESO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PROFESIONAL_VERIFICACION_APROBADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PROFESIONAL_VERIFICACION_CONSULTADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PROFESIONAL_VERIFICACION_MAS_INFO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PROFESIONAL_VERIFICACION_RECHAZADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PROFESIONAL_VERIFICACION_VENCIDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'SPAM_ALERTA_REVISION_ENVIADA';

-- Preventivo SPEC-427/427b (cierre de citas · 2026-09-04): 7 valores nuevos
-- del enum que escribirá la spec del cierre de citas. Agregados ANTES del
-- deploy para que el apply worker no aborte al replicar las primeras filas
-- (AccionAudit es enum en el suscriptor — confirmado por Kimi).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CODIGO_EMITIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CODIGO_DIGITADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CODIGO_FALLIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CUMPLIDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_EXPEDIENTE_ABIERTO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_AUTOCERRADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_NO_ASISTIO_PADRE';

-- Tras correr este script, los workers de sync reintentan solos (cada ~5 s).
-- Verificar con 04-verificar-replica.sql: todas las tablas deben quedar en
-- srsubstate = 'r'.
