# Tasks — Spec 080: Corrección del orden de migraciones (I-04)

**Spec**: `specs/080-orden-migraciones-colegio/spec.md` · **Plan**: `plan.md` · **Fecha**: 2026-07-22

## Fase 1 — Setup

- [x] T001 `npm install` (node_modules ausente en el worktree) y `docker-compose up -d db`.

## Fase 2 — Implementación (US1/US2, P1)

- [x] T002 Renombrar migración: `git mv prisma/migrations/20260721001700_add_departamento prisma/migrations/20260720210000_add_departamento` (sin editar `migration.sql`).
- [x] T003 Verificación estática: confirmar que ninguna sentencia sobre `Departamento` queda en migraciones posteriores a `20260720214140_add_colegio` salvo las que dependen de ella (`grep -rn "Departamento" prisma/migrations/*/migration.sql`).

## Fase 3 — Validación desde cero (US1/US2/US3)

- [x] T004 `npx prisma migrate reset --force` (BD desde cero, aplica toda la cadena + seed).
- [x] T005 `npx prisma db seed` (idempotente tras reset).
- [x] T006 `npx prisma migrate status` → cero pendientes / cero fallidas.
- [x] T007 `npx prisma migrate dev --create-only` → drift = 0 (sin migraciones nuevas).

## Fase 4 — Gate de calidad y cierre

- [x] T008 `npm run lint && npm run test && npm run build && npx tsc --noEmit`.
- [x] T009 `./scripts/dev-restart.sh` + healthcheck.
- [x] T010 Documentación: `quickstart.md`, `cierre.md`, sección Implementación en `spec.md`, Status `CERRADA`, índice `specs/README.md`.
- [x] T011 Commit: `fix(migraciones): corrige orden add_departamento antes de add_colegio (spec 080, I-04)`.
