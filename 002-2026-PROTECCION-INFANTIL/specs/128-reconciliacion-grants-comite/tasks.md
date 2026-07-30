# Tasks: SPEC-128 — Reconciliación de grants del comité

**Input**: Design documents from `specs/128-reconciliacion-grants-comite/`
**Prerequisites**: plan.md (aprobado por ZEUS en compuerta §4, **Opción A** para BD existentes), spec.md, research.md

## Phase 1: Setup

*(Sin setup: fix acotado sobre el seed y scripts existentes.)*

- [x] T001 Verificar rama verde y tag de retorno `pre-cola-043` (hecho en la fase de diseño, 002-PI-043)

## Phase 2: Tests First (TDD)

- [x] T002 [US1] Guarda de regresión del default en `prisma/seed-security.test.ts`:
  `clavesPorRol.COMITE_VALIDACION` es exactamente `["comite_bandeja"]` y ADMIN deriva del
  catálogo completo (guarda estática sobre la fuente, patrón I-31). ROJO antes del fix
- [x] T003 [US1/US2] Test de BD del script de revocación en
  `scripts/revocar-grants-comite-muertos.test.ts`: comité con los 3 grants viejos → queda
  solo `comite_bandeja` activo; ADMIN intacto; catálogo intacto; segunda corrida sin
  cambios (idempotente). ROJO antes del script

## Phase 3: Core Implementation

- [x] T004 [US1] `clavesPorRol.COMITE_VALIDACION = ["comite_bandeja"]` en `prisma/seed.ts`
  (SOLO esa línea + comentario D-43, candado) (FR-001/002/003)
- [x] T005 [US2] Script idempotente `scripts/revocar-grants-comite-muertos.ts` (Opción A
  aprobada): `activo = false` en los `PermisoModulo` de COMITE_VALIDACION sobre `comite` y
  `comite_auditoria`; no borra módulos ni toca otros roles; verificación antes/después
  (FR-004)

## Phase 4: Línea base y gates

- [x] T006 Regenerar `docs/architecture/02-roles-capacidades.md`
  (`npx tsx scripts/arch/generar-roles-capacidades.ts`) (FR-006)
- [x] T007 Gate: `npm run test` + `npx tsc --noEmit` + `npm run build` + `npm run arch:check`
  verdes; `aislamiento.test.ts` verde sin tocarse (FR-007)
- [x] T008 Validación con `quickstart.md` (criterios 2, 3, 4, 5 del instructivo) + paso de
  despliegue documentado para el CEO (producción NO se toca)

## Phase 5: Cierre

- [x] T009 Status IMPLEMENTADO en `spec.md` + sección Implementación + actualización de `specs/README.md` (cierre completo tras auditoría de ZEUS)
