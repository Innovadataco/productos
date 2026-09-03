# Tasks · SPEC-372 · asignar huérfanos + edad servidor

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

- [x] T001 Leer `reconciliacion-huerfanos.ts`, la página `/asignar` y `reasignar/route.ts` (candado 15v5): confirmar que no existe endpoint y que el patrón es el de reasignar
- [x] T002 P4: importar EDAD_MENOR_MIN/MAX, edadDesdeAnio, validarEdadMenor en `hijos/route.ts` y reemplazar el `min(1900).max(2100)` por `refine`
- [x] T003 P4: 3 tests en `hijos/route.test.ts` — año 1900 → 400, año futuro → 400, año que da edad 12 → 201
- [x] T004 P3: endpoint `POST /api/admin/operadores/reconciliacion` con verifyAuth + assertModulo + checkRateLimit + errorToResponse
- [x] T005 P3: 5 tests de ruta — éxito con audit, sin huérfanos, flag off, 429, 403
- [x] T006 P3 UI: estado `reconciliando`, `ultimoResumen`, `errorReconciliar`; función `reconciliarAhora`; botón `primary` deshabilitado si cola=0; aviso con Badge por debajo
- [x] T007 P3 UI: 3 tests — deshabilitado con cola=0, click dispara + resumen + refresh, 403 sin romper la lista
- [x] T008 Registrar `page.test.tsx` en `vitest.unit.includes.ts`
- [x] T009 Docs: spec/plan/tasks + fila en `specs/README.md`
- [x] T010 Gates locales: tsc, arch/tokens/locks/ratchets, lint, unit tests
- [ ] T011 Verificación en vivo del CEO: apretar el botón, ver el aviso, `curl` con año fuera de rango
