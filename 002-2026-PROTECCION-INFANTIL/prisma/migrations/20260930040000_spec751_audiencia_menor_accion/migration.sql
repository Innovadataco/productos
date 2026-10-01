-- SPEC-751 · Agrega al tipo "AccionAudit" el valor del HECHO de la declaración de audiencia del
-- menor (Decreto 1377/2013 art. 12). ADITIVO: ADD VALUE IF NOT EXISTS no recrea el enum. Solo se
-- DECLARA acá; no se USA en esta misma migración (Postgres prohíbe usar un valor de enum en la
-- transacción que lo agrega). El service de SPEC-751 lo escribe en la MISMA tx que la fila
-- AudienciaMenor — ése es el rastro durable de responsabilidad (declaradoPor es SetNull).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'AUDIENCIA_MENOR_DECLARADA';
