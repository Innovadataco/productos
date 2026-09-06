\set ON_ERROR_STOP on
-- 09a-bi-db-pre-corte.sql · FASE 1 · Suscriptor bi-db ANTES de tocar PI
-- Producto 006 · BI v2 · 2026-09-05
--
-- Contexto: el script 02 corta columnas NOT NULL sin default de la publicación
-- (SolicitudComite.motivo, clasificacion_rubrica_votos.preguntasJson,
-- worker_logs.mensaje, IncidenteInfra.senal). Si el corte en PI ocurriera
-- primero, el apply worker recibiría INSERT en vivo sin valor para esas
-- columnas, reintentaría la MISMA transacción en bucle, la réplica se
-- detendría y el WAL se acumularía en el MASTER de producción de PI.
-- Reproducido por el CEO en un pg16 desechable; la inversión simple
-- (DROP COLUMN primero en bi-db) también revienta, por el otro lado
-- ("missing replicated column"). Lo que funciona es aflojar la constraint
-- CONSERVANDO la columna, antes del corte.
--
-- DÓNDE CORRE: en bi-db (SUSCRIPTOR), PRIMERO en la secuencia — antes de que
-- el CEO corra el DROP de EmbeddingReporte + el script 02 en el master de PI.
--
-- ORDEN OBLIGATORIO (completo en INSTRUCTIVO-REPLICA-006.md):
--   FASE 1 · bi-db:  ESTE ARCHIVO (DROP NOT NULL × 4, conservando la columna)
--   FASE 2 · pi-db:  Paso 1 (CEO: DROP TABLE EmbeddingReporte) + 02-pi-db-publicacion.sql
--   FASE 3 · bi-db:  ALTER SUBSCRIPTION bi006_replica_sub REFRESH PUBLICATION;
--                    09b-bi-db-limpieza-contenido.sql (recién ahí DROP COLUMN)
--
-- Idempotente: DROP NOT NULL es idempotente en PostgreSQL (re-corrible).

-- ── Aflojar NOT NULL en las 4 columnas cortadas (conservando la columna) ────
ALTER TABLE "SolicitudComite"             ALTER COLUMN motivo DROP NOT NULL;
ALTER TABLE "clasificacion_rubrica_votos" ALTER COLUMN "preguntasJson" DROP NOT NULL;
ALTER TABLE "worker_logs"                 ALTER COLUMN mensaje DROP NOT NULL;
ALTER TABLE "IncidenteInfra"              ALTER COLUMN senal DROP NOT NULL;

-- ── Verificación (checker del CEO): deben salir 4 filas, todas YES ───────────
SELECT table_name, column_name, is_nullable
  FROM information_schema.columns
 WHERE (table_name, column_name) IN (
   ('SolicitudComite','motivo'),
   ('clasificacion_rubrica_votos','preguntasJson'),
   ('worker_logs','mensaje'),
   ('IncidenteInfra','senal')
 );
-- Esperado: 4 filas · is_nullable = YES en todas. Si falta una o dice NO,
-- NO avanzar a la Fase 2 — la réplica se detendría al cortar la publicación.
