# Cierre: Spec 070 — Simulación de carga y comparación de modelos

**Status final**: CERRADA
**Rama**: `feature/001-scaffolding`
**Fecha de cierre**: 2026-07-20

---

## Resumen por User Story

| User Story | Estado | Archivos principales |
|---|---|---|
| US1 — Cargar set de casos | Completado | `src/lib/simulacion/parser.ts`, `src/lib/schemas/simulacion.ts`, `NuevaSimulacionForm.tsx` |
| US2 — Ejecutar simulación con pipeline real | Completado | `src/lib/simulacion/executor.ts`, `src/lib/queue.ts`, `scripts/worker-reportes.mjs`, `src/app/api/reportes/procesar/**` |
| US3 — Monitorear en vivo | Completado | `src/app/api/admin/ia/simulaciones/[id]/route.ts`, `SimulacionDashboard.tsx` |
| US4 — Resultados por reporte | Completado | `src/app/api/admin/ia/simulaciones/[id]/resultados/route.ts`, `TablaResultadosSimulacion.tsx` |
| US5 — Análisis agregado | Completado | `src/lib/simulacion/metricas.ts`, `MetricasSimulacion.tsx` |
| US6 — Comparar corridas | Completado | `src/app/api/admin/ia/simulaciones/comparar/route.ts`, `ComparadorSimulaciones.tsx` |
| US7 — Exportar resultados | Completado | `src/app/api/admin/ia/simulaciones/[id]/export/route.ts` |

---

## Decisiones técnicas aplicadas

- **Override de modelo por job**: se extendió `sendReporte` para aceptar `modeloClasificacion`, el worker lo propaga al body de `/api/reportes/procesar` y el helper `cargarParametrosClasificacion` aplica el override sin tocar `ParametroSistema`.
- **Un solo run en progreso**: el endpoint rechaza una segunda simulación con 409 si hay una en `PENDIENTE` o `EN_PROGRESO`.
- **Cancelación parcial**: `CANCELADA` detiene la creación de nuevos reportes en el worker; los jobs ya encolados continúan.
- **Persistencia del set**: se añadió `casosJson` a `SimulacionRun` para permitir "Repetir con otro modelo" sin reparsear el archivo original.
- **Modelo `Reporte` no modificado**: se respetó la restricción; `SimulacionReporte` almacena `reporteId` como scalar con índice y categoría esperada.

---

## Archivos tocados

- `prisma/schema.prisma`
- `prisma/migrations/20260720174150_add_simulacion_tables/migration.sql`
- `src/lib/schemas/simulacion.ts`
- `src/lib/simulacion/parser.ts`, `parser.test.ts`
- `src/lib/simulacion/executor.ts`
- `src/lib/simulacion/progreso.ts`
- `src/lib/simulacion/metricas.ts`
- `src/lib/queue.ts`
- `src/lib/test-utils.ts`
- `scripts/worker-reportes.mjs`
- `src/app/api/reportes/procesar/route.ts`
- `src/app/api/reportes/procesar/helpers/parametros.ts`
- `src/app/api/reportes/procesar/helpers/seguridad.ts`
- `src/app/api/admin/ia/simulaciones/route.ts`, `route.test.ts`
- `src/app/api/admin/ia/simulaciones/[id]/route.ts`, `route.test.ts`
- `src/app/api/admin/ia/simulaciones/[id]/cancelar/route.ts`, `route.test.ts`
- `src/app/api/admin/ia/simulaciones/[id]/resultados/route.ts`, `route.test.ts`
- `src/app/api/admin/ia/simulaciones/[id]/analisis/route.ts`, `route.test.ts`
- `src/app/api/admin/ia/simulaciones/[id]/export/route.ts`, `route.test.ts`
- `src/app/api/admin/ia/simulaciones/comparar/route.ts`, `route.test.ts`
- `src/components/modules/ia/IaEvalManager.tsx`
- `src/components/modules/ia/simulacion/*`
- `specs/070-simulacion-carga-modelos/spec.md`
- `specs/070-simulacion-carga-modelos/plan.md`
- `specs/070-simulacion-carga-modelos/quickstart.md`
- `specs/070-simulacion-carga-modelos/cierre.md` (este archivo)

---

## Validación

- `npx tsc --noEmit`: ✅ sin errores
- `npm run lint`: ✅ sin errores
- `npm run test`: ✅ 577 tests (anterior 556)
- `npm run build`: ✅ build exitoso
- `npx prisma migrate deploy`: ✅ migración aplicada sin pérdida de datos
- `./scripts/dev-restart.sh`: ✅ app en :5005 + worker levantados

---

## Deuda técnica y seguimiento

- **SSE/WebSocket para progreso**: el polling de 3s cumple el requerimiento, pero SSE reduciría carga en simulaciones muy grandes.
- **Paginación de exportación masiva**: para sets cercanos al límite de 200 el export actual es síncrono; si el volumen crece, conviene paginar.
- **Comparación de N corridas**: la UI actual soporta 2-5; la comparación de N corridas requiere rediseño de la tabla comparativa.
- **Índice HNSW manual**: la migración se generó sin `DROP INDEX` para no perder los índices vectoriales; se debe verificar `db:verify:hnsw` tras cada deploy.

---

## Commits

| User Story | Mensaje |
|---|---|
| US1 | `feat(simulacion): carga y validación de set de casos (US1)` |
| US2 | `feat(simulacion): ejecución por pipeline real con override por job (US2)` |
| US3 | `feat(simulacion): monitoreo en vivo y cancelación (US3)` |
| US4 | `feat(simulacion): resultados por reporte (US4)` |
| US5 | `feat(simulacion): análisis agregado y métricas (US5)` |
| US6 | `feat(simulacion): comparación de corridas por índice (US6)` |
| US7 | `feat(simulacion): exportación CSV/JSON de resultados (US7)` |
| Docs | `docs(simulacion): quickstart, cierre y status CERRADA (US docs)` |

---

## Notas de operación

- El worker debe ser reiniciado para que escuche la nueva cola `simulacion-run`.
- `DISABLE_RATE_LIMIT=true` debe mantenerse en desarrollo para que la inyección de volumen funcione.
- Los datos de simulación son descartables; nunca deben afectar las cuentas de trabajo.
