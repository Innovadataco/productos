# Tasks — SPEC-210 (002-PI-110)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar `spec.md` con US/AS/FR/NFR/SC y decisiones propuestas.
- [x] T002 [P1] Redactar `plan.md` con fases, estructura y cambios de código.
- [x] T003 [P1] Crear artefactos auxiliares: `data-model.md`, `research.md`, `quickstart.md`, `checklists/requirements.md`.
- [x] T004 [P1] Actualizar `.specify/feature.json` a `specs/210-modelos-base-pagos`.
- [x] T005 [P1] Actualizar `specs/README.md` con SPEC-210 en estado PLANEADO.
- [ ] T006 [P1] Commit "docs(SPEC-210/002-PI-110): modelos base pagos" + I-102 TZ en `docker-compose.yml`.

## Fase 2 — Schema y migración

- [ ] T007 [P1] Añadir enums de pagos a `prisma/schema.prisma`.
- [ ] T008 [P1] Añadir/modelificar `Suscripcion`, `Plan`, `Pago`, `BonoPromocional`, `BonoAplicado`, `CodigoReferidoUso`, `TasaCambio` con `@db.Timestamptz(6)`.
- [ ] T009 [P1] Añadir relaciones inversas en `Colegio` y `Usuario`.
- [ ] T010 [P1] Generar migración aditiva `pagos_modelos_base`; revisar SQL para evitar DROP/renames destructivos.
- [ ] T011 [P1] Verificar `npx prisma migrate dev` en BD local vacía y con datos placeholder.

## Fase 3 — Seed

- [ ] T012 [P1] Implementar `seedPlanesPagos(adminId)` en `prisma/seed.ts`: 20 planes con upsert anti-I-100.
- [ ] T013 [P1] Implementar `seedParametrosPagos()` en `prisma/seed.ts`: 11 parámetros `pagos.*` con upsert anti-I-100.
- [ ] T014 [P1] Wirear nuevas funciones en el flujo principal del seed.
- [ ] T015 [P1] Verificar idempotencia: correr `npm run db:seed` dos veces sin duplicados.

## Fase 4 — DAL

- [ ] T016 [P1] Crear `src/lib/dal/repositories/pagos-repository.ts` con CRUD base sobre los 7 modelos.
- [ ] T017 [P1] Crear `src/lib/dal/repositories/pagos-repository.test.ts` con tests de CRUD por modelo.
- [ ] T018 [P1] Verificar que `arch:check` no detecte import de `@/lib/prisma` fuera del repositorio.

## Fase 5 — Gate y cierre

- [ ] T019 [P1] Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- [ ] T020 [P1] Actualizar `specs/README.md` estado SPEC-210 a IMPLEMENTADO (post-aprobacional).
- [ ] T021 [P1] Push único a `origin/work/002-PI-110` y abrir PR a `feature/001-scaffolding`.
- [ ] T022 [P1] Redactar `cierre.md` con evidencia y deuda técnica.

## Dependencias y orden

- T007 → T008 → T010 → T012/T013 → T016 → T019.
- T007/T008 pueden hacerse en un solo commit.
- T012/T013 dependen de T010 (schema estable).
- T016 depende de T010.
