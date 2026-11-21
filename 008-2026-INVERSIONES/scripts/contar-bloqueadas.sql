-- Inversiones · cuántas asignaciones BLOQUEADAS ya guardadas no cumplen la regla de coherencia (solo lectura).
-- Lo corre el DUEÑO contra su base, antes de la carga y después de desplegar la regla. Devuelve una fila por
-- código: `codigo` y `filas`. Solo conteos, nunca ids, cantidades ni costos.
--   Mac (base del dueño):
--     psql "postgresql://…/inversiones" -X -v ON_ERROR_STOP=1 -f scripts/contar-bloqueadas.sql
--   Servidor: con psql como el dueño de la base, igual que contar-sin-validar.sql (ruta y comando:
--     <ver ESTADO en la gestión>).
-- Qué cuenta (la misma regla que src/lotes/coherencia.ts aplica a las bloqueadas antes del FIFO):
--   BLOQUEADAS                    total de asignaciones bloqueadas
--   BLOQUEADA_VENTA_AJENA         bloqueadas cuya orden no es una venta aprobada con acciones
--   BLOQUEADA_LOTE_AJENO          bloqueadas cuyo lote es de otra especie que su venta
--   BLOQUEADA_LOTE_POSTERIOR      bloqueadas en un lote comprado después de su venta
--   BLOQUEADA_EXCEDE_VENTA        ventas cuyas bloqueadas pasan su cantidad
--   BLOQUEADA_EXCEDE_LOTE         lotes cuyas bloqueadas pasan su cantidad
--   BLOQUEADA_EXCEDE_COSTO        lotes no agotados cuyas bloqueadas pasan su costo total
--   BLOQUEADA_COSTO_DESCUADRADO   lotes agotados por bloqueadas cuyo costo no suma el del lote (±1 COP)
-- Una misma bloqueada puede contar en más de un código (la app informa solo el primero, en este orden).
-- Si todo da 0 (salvo el total), no hay bloqueadas inválidas guardadas. No simula el FIFO: lo que solo sale al
-- completarlo (BLOQUEADA_INCOMPLETA, COSTO_NEGATIVO) y la especie y el id de cada caso los da
-- `npm run lotes:construir -- --ensayo`. La transacción es READ ONLY y termina en ROLLBACK: no puede escribir nada.
BEGIN TRANSACTION READ ONLY;
WITH b AS (
  SELECT a."ordenVentaId", a."loteId", a."cantidad", a."costoBase", o."lado", o."estado", o."cantidadCompletada",
         o."fechaOperacion", o."instrumentoId" AS "especieVenta", l."instrumentoId" AS "especieLote", l."fechaCompra"
  FROM "asignacion_venta" a
  JOIN "orden" o ON o."id" = a."ordenVentaId"
  JOIN "lote" l ON l."id" = a."loteId"
  WHERE a."bloqueada"
),
por_venta AS (
  SELECT b."ordenVentaId", sum(b."cantidad") AS "cantidad", max(b."cantidadCompletada") AS "vendida" FROM b GROUP BY b."ordenVentaId"
),
por_lote AS (
  SELECT b."loteId", sum(b."cantidad") AS "cantidad", sum(b."costoBase") AS "costo", max(l."cantidad") AS "delLote", max(l."costoTotal") AS "costoDelLote"
  FROM b JOIN "lote" l ON l."id" = b."loteId" GROUP BY b."loteId"
)
SELECT r.codigo, r.filas FROM (
  SELECT 1 AS n, 'BLOQUEADAS' AS codigo, count(*) AS filas FROM b
  UNION ALL SELECT 2, 'BLOQUEADA_VENTA_AJENA', count(*) FILTER (WHERE NOT (b."lado" = 'VENTA' AND b."estado" = 'APROBADO' AND b."cantidadCompletada" > 0)) FROM b
  UNION ALL SELECT 3, 'BLOQUEADA_LOTE_AJENO', count(*) FILTER (WHERE b."especieLote" <> b."especieVenta") FROM b
  UNION ALL SELECT 4, 'BLOQUEADA_LOTE_POSTERIOR', count(*) FILTER (WHERE b."fechaCompra" > b."fechaOperacion") FROM b
  UNION ALL SELECT 5, 'BLOQUEADA_EXCEDE_VENTA', count(*) FILTER (WHERE v."cantidad" > v."vendida") FROM por_venta v
  UNION ALL SELECT 6, 'BLOQUEADA_EXCEDE_LOTE', count(*) FILTER (WHERE p."cantidad" > p."delLote") FROM por_lote p
  UNION ALL SELECT 7, 'BLOQUEADA_EXCEDE_COSTO', count(*) FILTER (WHERE p."cantidad" < p."delLote" AND p."costo" > p."costoDelLote") FROM por_lote p
  UNION ALL SELECT 8, 'BLOQUEADA_COSTO_DESCUADRADO', count(*) FILTER (WHERE p."cantidad" = p."delLote" AND abs(p."costo" - p."costoDelLote") > 1) FROM por_lote p
) AS r
ORDER BY r.n;
ROLLBACK;
