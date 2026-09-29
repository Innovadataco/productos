-- SPEC-780 · Agrega al tipo "AccionAudit" el valor del HECHO de la rectificación del relato
-- de la cita (habeas data). ADITIVO: ADD VALUE IF NOT EXISTS no recrea el enum. Solo se
-- DECLARA acá; no se USA en esta misma migración (Postgres prohíbe usar un valor de enum en la
-- transacción que lo agrega).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_RELATO_CORREGIDO';
