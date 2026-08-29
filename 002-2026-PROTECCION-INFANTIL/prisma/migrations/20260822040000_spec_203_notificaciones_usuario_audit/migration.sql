-- SPEC-203 (002-PI-100): valores de auditoría para preferencias y lectura de notificaciones del usuario final.
ALTER TYPE "AccionAudit" ADD VALUE 'NOTIFICACION_PREFERENCIA_ACTUALIZADA';
ALTER TYPE "AccionAudit" ADD VALUE 'NOTIFICACION_USUARIO_LEIDA';
