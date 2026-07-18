# Plan — Spec 020: Reorganización de módulos + Tablero de monitoreo

> Fecha: 2026-07-18.

## Fases

### Fase 1 — Asignador configurable (sin cambiar default)

- Leer `operadores.cupo_maximo_default` y `operadores.estrategia_asignacion` desde `ParametroSistema` con fallback.
- Refactorizar `src/lib/operadores/asignador.ts` para usar el default cuando `perfilOperador.cupoMaximo` no esté seteado.
- Soportar estrategia `aleatorio_puro` además de `ponderado_carga_inversa`.
- Agregar params a `crearParametrosReportes` para tests.
- Tests: asignador con params custom y default.

### Fase 2 — API de asignación y modelo

- `GET /api/admin/operadores/asignacion`: cola sin asignar, operadores activos con carga, distribución actual.
- `GET /api/admin/operadores/modelo`: config actual.
- `PATCH /api/admin/operadores/modelo`: actualizar config + `AuditLog` `CONFIGURACION_ASIGNACION_ACTUALIZADA`.
- Tests de endpoints.

### Fase 3 — Reorganización UI Operadores

- Crear subnavegación en `/dashboard/admin/operadores`.
- `/dashboard/admin/operadores/asignar/page.tsx`: estado en vivo + enlace a gestión.
- `/dashboard/admin/operadores/gestion/page.tsx`: mover CRUD actual.
- `/dashboard/admin/operadores/modelo/page.tsx`: formulario de config + explicación.
- Actualizar `AdminNav`: link a `/dashboard/admin/operadores/asignar` o mantener padre.

### Fase 4 — API de monitoreo operativo

- `GET /api/admin/estadisticas/clasificacion`: métricas operativas de revisión humana.
- Tests.

### Fase 5 — Reorganización UI Dashboard + tablero

- Crear subnavegación en `/dashboard/admin/estadisticas`.
- `/dashboard/admin/estadisticas/operacion/page.tsx`: mover `AdminDashboard`.
- `/dashboard/admin/estadisticas/clasificacion/page.tsx`: nuevo tablero.
- Actualizar `AdminNav`.

### Fase 6 — Cierre

- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test -- --run`, `npx tsx scripts/smoke-e2e.ts`.
- `reporte-cierre.md`.
- Actualizar `specs/README.md`.
- Commits separados + push.

## Archivos esperados

- `src/lib/operadores/asignador.ts` (modificado)
- `src/lib/operadores/asignador.test.ts` (ampliado)
- `src/lib/reporte-test-utils.ts` (params nuevos)
- `src/app/api/admin/operadores/asignacion/route.ts` (nuevo)
- `src/app/api/admin/operadores/modelo/route.ts` (nuevo)
- `src/app/api/admin/estadisticas/clasificacion/route.ts` (nuevo)
- `src/app/dashboard/admin/operadores/page.tsx` (subnav)
- `src/app/dashboard/admin/operadores/asignar/page.tsx` (nuevo)
- `src/app/dashboard/admin/operadores/gestion/page.tsx` (mover CRUD)
- `src/app/dashboard/admin/operadores/modelo/page.tsx` (nuevo)
- `src/app/dashboard/admin/estadisticas/page.tsx` (subnav)
- `src/app/dashboard/admin/estadisticas/operacion/page.tsx` (mover dashboard)
- `src/app/dashboard/admin/estadisticas/clasificacion/page.tsx` (nuevo)
- `src/components/modules/AdminNav.tsx` (actualizar links)
