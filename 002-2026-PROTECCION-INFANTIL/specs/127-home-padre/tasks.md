# Tasks: SPEC-127 — Home del padre

**Input**: Design documents from `specs/127-home-padre/`
**Prerequisites**: plan.md (aprobado por ZEUS en compuerta §4), spec.md, research.md

## Phase 1: Setup

*(Sin setup: fix acotado sobre código y tests existentes.)*

- [x] T001 Verificar rama verde y tag de retorno `pre-cola-043` (hecho en la fase de diseño, 002-PI-043)

## Phase 2: Tests First (TDD)

- [x] T002 [US1] Test de regresión del camino PARENT en `src/lib/proxy.test.ts`: redirect de
  ruta admin-only → `Location: /dashboard` → `proxy()` sobre `/dashboard` permitido (sin
  segundo rebote). ROJO antes del fix (FR-004)
- [x] T003 [US1] Test de la tabla home-por-rol completa (COMITE/SCHOOL_ADMIN/PARENT/ADMIN/
  OPERADOR) como guarda del default interno (FR-002)

## Phase 3: Core Implementation

- [x] T004 [US1] Caso `PARENT → /dashboard` en `homeForRole` de `src/lib/proxy.ts` (SOLO esa
  función, candado D-42) con comentario I-40/D-42 (FR-001/003)

## Phase 4: Línea base y gates

- [x] T005 Regenerar `docs/architecture/03-pantallas.md` (`npx tsx scripts/arch/generar-pantallas.ts`) (FR-005)
- [x] T006 Gate D-36: `npm run test` + `npx tsc --noEmit` + `npm run build` + `npm run arch:check` verdes (FR-006)
- [x] T007 Validación con `quickstart.md` (criterios 1, 2, 4, 5 del instructivo)

## Phase 5: Cierre

- [x] T008 Status IMPLEMENTADO en `spec.md` + sección Implementación + actualización de `specs/README.md` (cierre completo tras auditoría de ZEUS)
