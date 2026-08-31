# Tasks: SPEC-330 · rol de reglas de notificación = enum (padre)

**Radicado**: 002-PI-230 · **Branch**: `work/pi-SPEC-330-rol-reglas-notificacion-enum`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Phase 1: Setup

- [x] T001 Worktree aislado sobre `origin/main` (0bc324054, con A-58 dentro) + `npm ci` propio (D-82)

## Phase 2: Foundational (revisión — candados 15v5/22v5/26)

- [x] T002 Enumerar por grep las filas del padre en `prisma/seed.ts` (15 `rol:"PADRE"`) y todos los consumidores de `notificacionRegla.rol`; confirmar que ninguno espera el string viejo y que `motor.ts` dispara por evento
- [x] T003 Confirmar causa raíz en fuente: `preferencias.ts:37` y `:104` comparan `r.rol` contra `user.rol` (enum) — reproducir en test antes de arreglar

## Phase 3: US1 — El padre ve y controla sus preferencias (P1)

- [x] T004 [US1] `prisma/seed.ts`: renombrar `rol: "PADRE"` → `rol: "PARENT"` en las 15 filas del padre (3342–3379). NO tocar `"RECTOR_COLEGIO"` ni otras.
- [x] T005 [US1] Migración de datos idempotente `prisma/migrations/<ts>_spec_330_rol_notificacion_parent/migration.sql`: `UPDATE "notificacion_reglas" SET rol='PARENT' WHERE rol='PADRE';`
- [x] T006 [US1] Test unidad `preferencias`: `obtenerPreferenciasUsuario(id,"PARENT")` devuelve `reporte.resuelto` + `suscripcion.*`; con `"PADRE"` devuelve vacío (reproduce el bug). `actualizarPreferencia(...,"PARENT",...)` → `{ok:true}`.

## Phase 4: Verificación

- [x] T007 Job `verificaciones` completo local (tsc·lint·tokens·arch·locks·ratchets) + `specs-discipline.test.ts` + los tests nuevos
- [x] T008 Migración: 2ª corrida = 0 filas (idempotencia) — validada en CI (prisma migrate bloqueado local por classifier)

## Phase 5: Cierre

- [x] T009 Fila 330 en `specs/README.md`
- [ ] T010 Commit + push; `gh pr view --json files` (I-101 v3): seed + migración + tests, cero fuera de scope
- [ ] T011 Fábrica PI-1 mergea en su boundary → CEO despliega → §6b en vivo (padre ve los 2 toggles)

## Fuera de scope (hallazgo diferido — radicado aparte del CEO)

- Colisión multi-rol por `@@unique([evento,canal,plantillaClave])` sin `rol` (rector/comité/operador; `referido.tope_anual` EMAIL pisado por ADMIN). NO se toca aquí (fence de plantillas/identidad, candado 17).

## Dependencias

- T002/T003 (revisión) antes de T004–T006.
- T004+T005 antes de T006 (el test valida el comportamiento arreglado y el bug previo).
- T004–T006 antes de T007.
