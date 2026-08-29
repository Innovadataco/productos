# Cierre: SPEC-155 — Timeline "Ver proceso" para ADMIN

## Estado

🟢 Implementada (integrada en `feature/001-scaffolding`).

## Resumen

Se implementó el timeline interno de proceso de un reporte para ADMIN, combinando `TransicionReporte` y `ReintentoReporte` en orden cronológico y sin exponer PII.

## Cambios entregados

- `src/lib/reportes/timeline-proceso.ts`: servicio que une transiciones y reintentos.
- `src/app/api/admin/reportes/[id]/proceso/route.ts`: endpoint exclusivo para ADMIN.
- `src/components/modules/AdminReporteProceso.tsx`: componente de timeline.
- `src/components/modules/AdminReporteExpediente.tsx`: pestaña **Proceso** en el modal de expediente.
- `src/app/api/admin/reportes/[id]/proceso/route.test.ts`: tests de integración.
- `docs/architecture/02-roles-capacidades.md`: regenerado para reflejar la nueva ruta API.

## Gate de calidad

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run tokens:check` ✅
- `npm run arch:check` ✅
- `npm run test:coverage` ✅
- `npm run build` ✅

## Evidencia de integración

- Rama: `work/002-pi-058`
- Hash local previo al push: `74a3c470`
- PR a `feature/001-scaffolding`: #36
- Hash de merge en `feature/001-scaffolding`: `667764e6`
- CI-PUSH verde: `31364132971`

## Notas

- No se modificó `src/lib/ai/**` (I-29 intacto).
- No se realizaron migraciones de datos.
