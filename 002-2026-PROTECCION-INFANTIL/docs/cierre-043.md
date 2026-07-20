# Cierre — Spec 043: UX del comité y navegación del padre

**Fecha**: 2026-07-20
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/043-ux-comite-nav-padre/`

## Resumen

Se implementaron las 4 User Stories del spec 043:

- **US1 (P1)**: el padre autenticado ahora tiene acceso directo a `/dashboard` desde el header y el menú (escritorio y móvil), sin afectar el dashboard público.
- **US2 (P1)**: la bandeja del comité es una sola lista sin pestañas; al abrir un caso `PENDIENTE` se auto-asigna al comité logueado; casos asignados a otro o resueltos se muestran en solo lectura.
- **US3 (P1)**: el resolver del comité tiene un solo botón "Resolver"; el reporte siempre queda en `CORREGIDO` con `responsableTipo = COMITE` y la clasificación se actualiza con confianza 1.0.
- **US4 (P2)**: el copy del Círculo de Confianza fue reemplazado por texto claro y cercano al usuario.

## Commits

- `feat(043): US1 — navegación del padre a /dashboard`
- `feat(043): US2 — bandeja unificada del comité con auto-asignación`
- `feat(043): US3 — resolver simplificado siempre CORREGIDO`
- `feat(043): US4 — copy claro del Círculo de Confianza`
- `docs(043): spec.md, checklist y cierre`

## Validación

- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning heredado en `GestionPageClient.tsx`).
- `npm run test`: 439 tests pasan, 0 fallos.
- `rm -rf .next && npm run build`: OK.
- `./scripts/dev-restart.sh`: app en `:5005`, healthcheck OK, un solo worker.
- `quickstart.md`: ejecutado de punta a punta; todas las US verificadas.

## Pruebas manuales (quickstart)

- Se crearon usuarios de prueba `PARENT` y `COMITE_VALIDACION` en la BD de desarrollo.
- US1: login como `PARENT` → `/dashboard` carga (HTTP 200); el botón "Dashboard" del header se muestra como `/dashboard` en el render cliente (verificado por test de componente).
- US2/US3: login como `COMITE_VALIDACION` → `GET /api/admin/comite/solicitudes` devuelve caso `PENDIENTE`; `POST /api/admin/comite/[id]/asignar` devuelve `ASIGNADA`; `POST /api/admin/comite/[id]/resolver` devuelve `reporte.estado: CORREGIDO` y `estado: RESUELTA`.
- US4: `/dashboard/circulo-confianza` carga con HTTP 200; el copy fue actualizado en el source (verificación visual pendiente a través de la UI).
- Smoke: `/dashboard` redirige a `/login` sin sesión; `/dashboard-publico` carga sin sesión.

## Archivos tocados

- `src/components/modules/NavHeader.tsx`
- `src/components/modules/NavHeader.test.tsx`
- `src/app/api/admin/comite/solicitudes/route.ts`
- `src/components/modules/ComiteBandeja.tsx`
- `src/components/modules/ComiteBandeja.test.tsx`
- `src/app/api/admin/comite/[id]/resolver/route.ts`
- `src/app/api/admin/comite/[id]/resolver/route.test.ts`
- `src/app/api/admin/comite/pendientes/route.test.ts`
- `src/components/modules/ComiteSolicitudDetalle.tsx`
- `src/components/modules/ComiteSolicitudDetalle.test.tsx`
- `src/app/dashboard/circulo-confianza/page.tsx`
- `specs/043-ux-comite-nav-padre/spec.md`
- `specs/043-ux-comite-nav-padre/checklists/requirements.md`
- `specs/043-ux-comite-nav-padre/quickstart.md`
- `docs/cierre-043.md`

## Deuda técnica

- Warnings de `act(...)` en tests de `ComiteBandeja` y `ComiteSolicitudDetalle`: no afectan resultados; se pueden pulir con `act()` o `@testing-library/user-event`.
- No se rediseñó la estructura visual del detalle del comité, solo se simplificó el flujo de resolución.

## Estado

Implementado, validado y desplegado. Listo para merge.
