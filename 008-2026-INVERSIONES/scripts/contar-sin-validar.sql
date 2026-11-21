-- Inversiones · cuántas filas existentes NO cumplen cada CHECK que nació NOT VALID (solo lectura).
-- Lo corre el DUEÑO contra su base, antes de la migración que los valide. Devuelve una fila por restricción:
-- `restriccion`, `validada` y `filas_que_no_cumplen`. Solo conteos, nunca valores de las filas.
--   Mac (base del dueño):
--     psql "postgresql://…/inversiones" -X -v ON_ERROR_STOP=1 -f scripts/contar-sin-validar.sql
--   VPS (con $COMPOSE como en docs/despliegue/produccion.md):
--     sudo $COMPOSE exec -T inv-008-db psql -X -v ON_ERROR_STOP=1 -U inv_dueno -d inversiones \
--       < <raíz>/repo/008-2026-INVERSIONES/scripts/contar-sin-validar.sql   (<raíz>: ver ESTADO en la gestión)
-- Si todas dan 0, el VALIDATE CONSTRAINT entra en una migración posterior (nunca a mano: AGENTS.md lo
-- prohíbe) y el nombre sale de `sin_validar` en scripts/verificar-esquema.sql. Si alguna no da 0, esas filas
-- se revisan antes con el CEO; mientras tanto el CHECK protege igual cada fila nueva o modificada.
-- Cada conteo usa la MISMA expresión del CHECK de su migración (20261121100100_usuario_transiciones_checks):
-- una fila no cumple si la expresión da FALSE (NULL cumple, como en un CHECK). La transacción es READ ONLY y
-- termina en ROLLBACK: no puede escribir nada.
BEGIN TRANSACTION READ ONLY;
SELECT r.restriccion, c.convalidated AS validada, r.filas_que_no_cumplen
FROM (
  SELECT 'evento_corporativo_origen_destino_chk' AS restriccion, count(*) FILTER (WHERE NOT ("origenId" <> "destinoId")) AS filas_que_no_cumplen FROM "evento_corporativo"
  UNION ALL SELECT 'evento_corporativo_razon_chk', count(*) FILTER (WHERE NOT ("razon" IS NULL OR "razon" > 0)) FROM "evento_corporativo"
  UNION ALL SELECT 'dividendo_retencion_chk', count(*) FILTER (WHERE NOT ("retencion" IS NULL OR "retencion" >= 0)) FROM "dividendo"
  UNION ALL SELECT 'dividendo_tasa_retencion_chk', count(*) FILTER (WHERE NOT ("tasaRetencion" IS NULL OR ("tasaRetencion" >= 0 AND "tasaRetencion" <= 1))) FROM "dividendo"
  UNION ALL SELECT 'orden_fechas_chk', count(*) FILTER (WHERE NOT ("fechaLiquidacion" >= "fechaOperacion")) FROM "orden"
) AS r
LEFT JOIN pg_constraint c ON c.conname = r.restriccion AND c.connamespace = 'public'::regnamespace
ORDER BY r.restriccion;
ROLLBACK;
