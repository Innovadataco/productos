# Tareas: SPEC-155 — Timeline "Ver proceso"

## T001 [P] Servicio de timeline
- Archivo: `src/lib/reportes/timeline-proceso.ts`.
- Consultar `TransicionReporte` y `ReintentoReporte` por `reporteId`.
- Normalizar y ordenar por `creadoEn`.

## T002 [P] Endpoint ADMIN
- Archivo: `src/app/api/admin/reportes/[id]/proceso/route.ts`.
- Auth ADMIN, validar UUID, 404 si no existe reporte.

## T003 [P] UI del timeline
- Archivo: `src/app/dashboard/admin/reportes/[id]/proceso/page.tsx`.
- Mostrar eventos en línea de tiempo.

## T004 [P] Tests
- Tests de integración para ADMIN, 403 no-ADMIN, 404 inexistente.

## T005 [P] Arquitectura y cierre
- Regenerar `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md`.
- Actualizar README, spec.md y feature.json.
