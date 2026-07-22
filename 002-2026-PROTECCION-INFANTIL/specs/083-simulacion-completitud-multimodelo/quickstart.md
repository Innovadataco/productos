# Quickstart — Spec 083: validación de completitud/métricas + multi-modelo (I-06)

**Propósito**: verificar el ciclo real de la simulación (progreso, COMPLETADA al final, métricas persistidas) y la ejecución secuencial multi-modelo.

## Prerrequisitos

- App + UN worker corriendo (`./scripts/dev-restart.sh`), Ollama activo con 2+ modelos de clasificación.
- Set de casos: `scripts/simulacion/simulacion-50-casos-eval.json` (50 casos con `categoriaEsperada`).
- Parámetro `ia.simulacion_timeout_minutos` creado por `npx prisma db seed` (default 60).
- Login ADMIN: `soporte@innovadataco.com` / `Admin123!Test`.

## A. Lanzar lote multi-modelo (US3)

Por UI: `/dashboard/admin/ia?tab=playground` → Simulación → Nueva simulación → cargar el JSON → paso 2 seleccionar 2 modelos (checkboxes) → Lanzar.

Por API (equivalente, usado en el cierre):

```bash
curl -c /tmp/pi-cookies.txt -X POST :5005/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"soporte@innovadataco.com","password":"Admin123!Test"}'
curl -b /tmp/pi-cookies.txt -X POST :5005/api/admin/ia/simulaciones \
  -H 'Content-Type: application/json' --data @body.json
# body.json: {"modelos":["ornith:9b","qwen2.5:14b"],"archivo":"<json de 50 casos>","formato":"json"}
# → 202 {"runIds":["<run1>","<run2>"],"estado":"PENDIENTE","totalCasos":50}
```

## B. Verificar ciclo real (US1/US2)

```sql
-- progreso real durante la corrida (crece 1..50, estado EN_PROGRESO)
SELECT modelo, estado, progreso, "totalCasos" FROM simulacion_runs WHERE id IN ('<run1>','<run2>');
-- al terminar run 1: COMPLETADA con fechaFin; run 2 arranca DESPUÉS (secuencia)
SELECT modelo, estado, progreso, "fechaInicio", "fechaFin" FROM simulacion_runs WHERE id IN ('<run1>','<run2>');
```

- `grep Lote /tmp/worker-002.log` → "run 1 terminó con estado COMPLETADA" antes de "creando reportes de run 2".
- `GET /api/admin/ia/simulaciones/<run1>` → `progreso: 50`, `metricasJson` con `accuracy`, `aciertos`, `latenciaPromedioMs`, `latenciaP50Ms`, `latenciaP95Ms`, `usoDesempate`, `casosFallidos`.

## C. Verificar métricas contra SQL directo (SC-002)

```sql
SELECT COUNT(*) FILTER (WHERE UPPER(REPLACE(sr."categoriaEsperada",' ','_')) = c.categoria::text) AS aciertos,
       COUNT(*) AS total
FROM simulacion_reportes sr
JOIN "ClasificacionIA" c ON c."reporteId" = sr."reporteId"
WHERE sr."simulacionRunId" = '<run1>';
-- aciertos/total DEBE coincidir con metricasJson.accuracy
```

## D. UI

- Dashboard de simulación: una card por modelo con progreso, accuracy y latencia p50 reales (no ceros).
- Detalle del run: tarjetas Accuracy / Aciertos / Desempate / Latencia prom. / p50 / p95 + tablas por categoría, matriz y falsos negativos.

## E. Runs zombi históricas (anteriores al fix)

Una run `EN_PROGRESO` vieja se cierra sola como `FALLIDA` al superar `ia.simulacion_timeout_minutos`
(la evalúa el hook de progreso o el GET detalle). Una COMPLETADA vieja sin métricas completas
las recalcula el GET detalle (backfill perezoso).

## F. Gate

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```
