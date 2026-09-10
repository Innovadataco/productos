# Tasks — SPEC-606

## Fase 1 · Datos

- [x] T001 Schema: tabla `CodigoStepUp` + 3 valores `AccionAudit` + relación en `Usuario` (`prisma/schema.prisma`).
- [x] T002 Migración aditiva `prisma/migrations/20260909170000_spec606_stepup_codigo_email/migration.sql` (aplicada en BD de test; cliente regenerado).
- [x] T003 Seed: parámetro `padre.texto.codigo_minutos` = 10 (`prisma/seed.ts`, upsert aditivo) + comentario del evento `padre.stepup.codigo`.

## Fase 2 · Backend

- [x] T004 Servicio `src/lib/dal/services/stepup-codigo.ts` (generar/hash/enmascarar, solicitar con cooldown + un-vigente + fail-closed, verificar con 5 intentos + un solo uso, audits sin código).
- [x] T005 Scopes `stepup_codigo` (5/h) y `stepup_verificar` (15/10 min) en `src/lib/rate-limit.ts`.
- [x] T006 Reescritura `src/app/api/padre/step-up/codigo/route.ts` (toda cuenta PARENT, 429 cooldown con `reintentaEnSegundos` + `correoEnmascarado`).
- [x] T007 Reescritura `src/app/api/padre/step-up/verificar/route.ts` (zod 6 dígitos, mapa 204/400/401/403/429, sello intacto).
- [x] T008 [P] `GET texto`: 403 siempre `metodos: ["codigo_email"]` (`src/app/api/padre/reportes/[id]/texto/route.ts`).
- [x] T009 [P] Eliminación `src/app/api/padre/step-up/route.ts` + su test (step-up por contraseña, sin consumidores).
- [x] T010 [P] `src/lib/routing/stepup-sello.ts`: fuera wrappers de step-up; token firmado solo para «Crear contraseña».

## Fase 3 · UI

- [x] T011 `src/components/modules/padre/TextoSensible.tsx`: panel automático tras 403 (correo enmascarado, 6 casillas con auto-avance/pegado, vigencia mm:ss, reenvío con cooldown), anillo de cuenta regresiva en el revelado, retapado intacto.

## Fase 4 · Tests

- [x] T012 Integración `src/app/api/padre/step-up/codigo/route.test.ts` (10 casos: 403 metodos, solicitar, cooldown, un vigente, rate limit, verificar/sello/consumo, ×5, vencido, formato/sesión).
- [x] T013 Unit `src/components/modules/padre/TextoSensible.test.tsx` (6 casos) + alta en `vitest.unit.includes.ts`.
- [x] T014 [P] Ajuste `src/lib/routing/stepup-sello.test.ts` y `src/app/api/auth/crear-password/route.test.ts` (propósito ajeno artesanal).

## Fase 5 · Cierre

- [x] T015 Artefactos `specs/606-revelar-codigo/` + fila en `specs/README.md` + `.specify/feature.json`.
- [x] T016 Regenerar `docs/architecture/` y dejar `npm run arch:check` en VERDE.
- [x] T017 Gate: `npx tsc --noEmit` + `npm run lint` + shards 1-6 + `npm run test:unit` + `npm run build`.
- [ ] T018 Commit (español, imperativo) + push + PR `SPEC-606: …` (sin mergear).
