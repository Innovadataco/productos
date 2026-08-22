# Cierre SPEC-197 — Fixes operadores + usuarios (002-PI-094)

## Estado

- **Spec**: IMPLEMENTADO → FINALIZADO (pendiente CI 6/6 y ACTA de ZEUS → CERRADA).
- **Rama**: `work/002-pi-094`.
- **Base**: `feature/001-scaffolding`.
- **Commit de cierre**: *(se completa tras push)*.

## Qué se entregó

| Incidencia | Cambio | Archivos principales |
|------------|--------|----------------------|
| **I-91** | Se quitó el botón "Reasignar caso" del listado `/dashboard/admin/operadores/asignar`; solo queda "Ver detalle". La reasignación sigue disponible en `/dashboard/admin/operadores/[id]`. | `src/app/dashboard/admin/operadores/asignar/page.tsx` |
| **I-92** | El modal `ReasignarModal.tsx` filtra el dropdown destino a operadores activos con `casosAbiertos < cupoMaximo`, excluyendo el operador actual. | `src/components/modules/operadores/ReasignarModal.tsx` |
| **I-97** | Se crearon las páginas de sub-tabs en `/dashboard/admin/usuarios/{rectores,operadores,comite,admins}` reutilizando `UsuariosAdminClient` con el rol por prop. | `src/app/dashboard/admin/usuarios/*/page.tsx`, `src/components/modules/admin/UsuariosAdminClient.tsx` |
| **Tests** | Se añadió `UsuariosSubNav.test.tsx` y se registró en `vitest.unit.includes.ts` para cobertura unitaria. | `src/components/modules/admin/UsuariosSubNav.test.tsx`, `vitest.unit.includes.ts` |

## Gate local

Corridos en worktree aislado (`/Users/idc/Documents/GitHub/productos-002-pi-094`):

- ✅ `npx tsc --noEmit` — sin errores.
- ✅ `npm run lint` — 0 errores (43 warnings preexistentes, ninguno nuevo).
- ✅ `npm run test:unit` — 917 tests en 139 archivos, verde.
- ✅ `npm run arch:check` — verde tras regenerar `02-roles-capacidades.md` y `03-pantallas.md`.
- ✅ `npm run tokens:check` — verde.
- ✅ `npm run build` — compilación exitosa.

> Nota: `test:integration` presentó un flake en `src/app/api/admin/anti-abuso/bloquear/route.test.ts` (500 vs 200) cuando corre con todo el suite; al ejecutar ese archivo solo pasa verde. ZEUS indicó que ese archivo pertenece al alcance de SPEC-095 (ODIN 2) y no es bloqueante para SPEC-197.

## Decisiones / notas

- Se usó **worktree separado** (`productos-002-pi-094`) para evitar interferencias del clone compartido (I-89); el worktree original (`002-2026-PROTECCION-INFANTIL`) estaba siendo modificado por otra sesión de ODIN (`work/002-pi-095`).
- Se regeneraron los artefactos de arquitectura porque las nuevas páginas de sub-tabs introdujeron drift en `02-roles-capacidades.md` y `03-pantallas.md`.
- No se tocó `src/lib/ai/**`, rate-limit ni motor.
- Cero migraciones de BD.

## PR

- Título: `SPEC-094 (002-PI-094): fixes operadores + usuarios (I-91 I-92 I-97)`
- Base: `feature/001-scaffolding`
- Rama origen: `work/002-pi-094`
