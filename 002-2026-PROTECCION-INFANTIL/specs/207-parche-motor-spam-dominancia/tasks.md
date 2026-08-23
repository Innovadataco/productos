# Tasks — SPEC-207 (002-PI-140)

## Fase 1 — Especificación y diseño
- [x] T001 [P1] Redactar `spec.md`.
- [x] T002 [P1] Redactar `plan.md`.
- [x] T003 [P1] Crear artefactos auxiliares.

## Fase 2 — Implementación
- [ ] T004 [P1] Actualizar `prisma/seed.ts`: `spam.dominancia_umbral=0.33` + `spam.dominios_acortadores` JSON.
- [ ] T005 [P1] Implementar hard-rule `spam_publicitario_deterministico` en `src/lib/ai/guardas.ts`.
- [ ] T006 [P1] Integrar hard-rule ANTES de guarda dominancia.
- [ ] T007 [P1] Loggear modelo sin respuesta en `src/lib/ai/sandbox.ts`.
- [ ] T008 [P1] Tests unitarios de hard-rule y RPT-QFUHE8.
- [ ] T009 [P1] Gate local completo.
