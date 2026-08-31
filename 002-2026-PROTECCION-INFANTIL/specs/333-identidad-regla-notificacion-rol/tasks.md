# Tasks: SPEC-333 · identidad de regla de notificación por rol (A-63)

**Radicado**: 002-PI-233 · **Branch**: `work/pi-SPEC-333-identidad-regla-notificacion-rol`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Decisión: A**

## Phase 1: Setup
- [x] T001 Worktree + `npm ci` (D-82) · base con SPEC-330 dentro

## Phase 2: Revisión (candados 15v5/22v5/26)
- [x] T002 A/B decidido = A (evidencia seed: plantillas rol-genéricas)
- [x] T003 Hallazgo motor (findByEventoActivo sin filtro rol → duplicados al des-colapsar); scope motor confirmado por CEO

## Phase 3: Identidad + migración
- [x] T004 `schema.prisma`: `@@unique([evento,canal,plantillaClave])` → `@@unique([evento,canal,plantillaClave,rol])`
- [x] T005 Migración `<ts>_spec_333_identidad_regla_rol/migration.sql`, EN ORDEN (candado 26): (1) `UPDATE ... SET rol='SCHOOL_ADMIN' WHERE rol='RECTOR_COLEGIO'` bajo el índice viejo (≤1 fila por (evento,canal,plantilla) → sin colisión); (2) `DROP INDEX` viejo; (3) `CREATE UNIQUE INDEX` nuevo con rol. El des-colapso lo completa el re-seed.

## Phase 4: Seed
- [x] T006 `seed.ts`: 11 filas `"RECTOR_COLEGIO"`→`"SCHOOL_ADMIN"` (grep, verificar count)
- [x] T007 `upsertNotificacionRegla` where → `evento_canal_plantillaClave_rol` (clave compuesta con rol)

## Phase 5: Motor rol-aware (US2)
- [x] T008 [US2] `motor.ts`: `destinatario.rol?` en `ProgramarInput`; en `programar`, si el evento tiene >1 rol distinto → filtrar reglas por `rolEfectivo = destinatario.rol ?? Usuario.rol(usuarioId)`; 1 rol → sin cambio. Defensivo: multi-rol + rol indeterminado → log+skip.
- [x] T009 [US2] Callers multi-rol pasan `rol` por destinatario: `vigencia.service.ts`, `referido.service.ts`, emisor `caso.asignado` (enumerar archivo:línea)

## Phase 6: Tests (candado 24v2 · US1/US2/US3)
- [x] T010 `motor.test.ts`: padre 1 envío -1d · +0m multi-rol cero duplicados · rector -5d · email-only con rol explícito
- [x] T011 `preferencias.test.ts`: SCHOOL_ADMIN/OPERADOR/COMITE_* ven sus grupos tras des-colapsar
- [x] T012 `email.migracion.test.ts` verde (alcance obligatorio) + evidencia BD conteo por (evento,canal)

## Phase 7: Verificación + cierre
- [x] T013 Job `verificaciones` completo (tsc·lint·tokens·arch·locks·ratchets) + `specs-discipline`
- [x] T014 Fila 333 en `specs/README.md` · Status IMPLEMENTADO
- [x] T015 Rebase sobre main · commit · push · `gh pr view --json files` (I-101 v3)
- [ ] T016 Fábrica mergea en su boundary → CEO despliega (migración + re-seed)

## Dependencias
- T004+T005 antes de T006/T007 · T007 (identidad) antes de T008 · T008 antes de T009 · T008/T009 antes de T010 · todo antes de T013.
