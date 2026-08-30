# Tasks — SPEC-315 · Fix reset password flag (002-PI-215)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Branch**: `work/pi-SPEC-315-fix-reset-password-flag` · **Base**: `main` @ `ce03c2bdf`

## Overview

Fix de 1 línea: `debeCambiarPassword: false` en `restablecerPassword`. Compuerta §4 LIGERA. 2 archivos de código (fix + test nuevo).

---

## Phase 1 · Setup

- [X] T001 Verificar worktree en `pi-SPEC-315-fix-reset-password-flag` @ `ce03c2bdf`, rama correcta, sin cambios pendientes fuera de scope.
- [X] T002 Confirmar en fuente el bug (`autenticacion.ts:228-234` sin `debeCambiarPassword: false`) y el patrón correcto (`cambiarPassword:157`). Candado 22 recíproco: solo `restablecerPassword` se toca.

## Phase 2 · Fix (US1 · P1)

- [X] T003 [US1] Añadir `debeCambiarPassword: false` + comentario SPEC-315 al `actualizar` de `restablecerPassword` en `src/lib/dal/services/autenticacion.ts`.
- [X] T004 [US1] Crear `src/lib/dal/services/autenticacion.test.ts` con 5 casos: SC-001 (flag true→false), SC-002 (otros 4 campos sin regresión + hash verificable), SC-002 (token marcado usado), SC-003 (token inválido no toca BD), bonus (cambiarPassword :157 sigue limpiando el flag).

## Phase 3 · Polish & Verification

- [X] T005 Correr `autenticacion.test.ts` → 5/5 verde.
- [X] T006 Gate calidad: `tsc --noEmit` + `npm run lint -- <archivos>` grep error + `npm run test` completo (aprendizaje SPEC-314) + build.
- [X] T007 Commit + gate pre-push + push + PR + REALIZADO.

---

## Dependencies
- T001-T002 → T003-T004 → T005 → T006 → T007.

## MVP scope
US1 completa (fix + tests). No hay US2/US3.
