# Tareas: SPEC-156 — Panel de monitoreo del worker

## T001 [P] Registrar módulo de permisos
- Añadir `monitoreo_worker` al catálogo y asegurar que solo `ADMIN` tenga acceso.

## T002 [P] UI de monitoreo
- Archivo: `src/app/dashboard/admin/monitoreo/worker/page.tsx`.
- Consumir `GET /api/health/worker` y mostrar estado.

## T003 [P] Tests
- Tests de integración: ADMIN 200, no-ADMIN 403, panel sin botones destructivos.

## T004 [P] Arquitectura y cierre
- Regenerar `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md`.
- Actualizar README, spec.md y feature.json.
