-- Inversiones · conteo previo al despliegue de la migración 20261122030100_datos_oficiales (fase C, C1). Solo lectura.
-- Cuenta lo mismo que su guardia: si algo no da 0, la guardia aborta la migración y el despliegue queda P3009
-- (docs/despliegue/produccion.md §10). Devuelve una sola fila con: `decretos` (filas de dividendo_decretado) y, de
-- dividendo, cuántas traen montoBruto, retencion, tasaRetencion o decretadoId. Solo conteos, nunca valores.
-- Lo corre el DUEÑO (o quien él designe) contra su base, ANTES de desplegar la imagen que trae la migración:
--   Mac (base del dueño):
--     psql "postgresql://…/inversiones" -X -v ON_ERROR_STOP=1 -f scripts/contar-datos-oficiales.sql
--   VPS (con $COMPOSE como en docs/despliegue/produccion.md):
--     sudo $COMPOSE exec -T inv-008-db psql -X -v ON_ERROR_STOP=1 -U inv_dueno -d inversiones \
--       < <raíz>/repo/008-2026-INVERSIONES/scripts/contar-datos-oficiales.sql   (<raíz>: ver ESTADO en la gestión)
-- Si todo da 0, se despliega. Si algo no da 0, no se despliega: se avisa al CEO de 008 con los conteos (nada se
-- corrige a mano: AGENTS.md lo prohíbe). La transacción es READ ONLY y termina en ROLLBACK: no puede escribir nada.
BEGIN TRANSACTION READ ONLY;
SELECT
  (SELECT count(*) FROM "dividendo_decretado") AS decretos,
  count(*) FILTER (WHERE "montoBruto" IS NOT NULL) AS con_monto_bruto,
  count(*) FILTER (WHERE "retencion" IS NOT NULL) AS con_retencion,
  count(*) FILTER (WHERE "tasaRetencion" IS NOT NULL) AS con_tasa_retencion,
  count(*) FILTER (WHERE "decretadoId" IS NOT NULL) AS con_decreto_enlazado
FROM "dividendo";
ROLLBACK;
