# Tasks · SPEC-372 · asignar huérfanos + edad servidor

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Base (rama `work/pi-SPEC-372-A74-P3-P4` — PR #266)

- [x] T001 Leer `reconciliacion-huerfanos.ts`, la página `/asignar` y `reasignar/route.ts` (candado 15v5): confirmar que no existe endpoint y que el patrón es el de reasignar
- [x] T002 P4: helper `validarAnioNacimientoMenor` en `documento-menor.ts` + test unit
- [x] T003 P4: aplicar el helper después del safeParse en el POST de `hijos/route.ts` + test
- [x] T004 P4: aplicar el mismo helper en el PATCH de `hijos/[id]/route.ts` + test (cierra el hueco por edición)
- [x] T005 P3: endpoint `POST /api/admin/operadores/reconciliar-huerfanos` con verifyAuth+assertModulo+checkRateLimit+errorToResponse + audit del disparo manual
- [x] T006 P3: 4 tests de ruta — dispara+asigna+audita, sin huérfanos → 0, sin sesión → 401, no-admin → 401/403
- [x] T007 P3 UI: botón "Asignar huérfanos ahora" junto a "Actualizar" con aviso de texto y refresh

## Follow-up (esta rama)

- [x] T008 Docs Spec Kit: spec/plan/tasks + fila en `specs/README.md`
- [x] T009 Regenerar `docs/architecture/02-roles-capacidades.md` (nueva ruta admin)
- [x] T010 `page.test.tsx` del botón adaptado a `/reconciliar-huerfanos` + registro en `vitest.unit.includes.ts`
- [x] T011 Gates locales: tsc, arch/tokens/locks/ratchets, lint, unit + specs-discipline
- [ ] T012 Verificación en vivo del CEO: apretar el botón, ver el aviso, `curl` con año fuera de rango en POST y PATCH
