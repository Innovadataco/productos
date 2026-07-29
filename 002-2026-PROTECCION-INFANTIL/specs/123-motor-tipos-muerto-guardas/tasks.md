# Tasks — Spec 123

## Fase 1 — Artefactos

- [x] T001 Crear `specs/123-motor-tipos-muerto-guardas/spec.md`, `plan.md`, `tasks.md`

## Fase 2 — US1 Tipos desde Prisma

- [ ] T002 Reemplazar `CategoriaConducta` manual por import/re-export de `@prisma/client` en `src/lib/ai/classifier.ts:6-18`
- [ ] T003 Reemplazar `EstadoReporte` manual por `import type` de `@prisma/client` en `src/lib/ai/classifier.ts:20-28`
- [ ] T004 Commit b) con evidencia (enum schema.prisma:154 y :169 idénticos)

## Fase 3 — US2 Código muerto

- [ ] T005 Podar `getDefaultOllamaBaseUrl` (`src/lib/ai/ollama-config.ts:47`) — commit con evidencia grep
- [ ] T006 Podar `llamarOllama` (`src/lib/ai/ollama-client.ts:41-94`) y ajustar `src/lib/ai/ollama-timeout.test.ts` a `llamarOllamaStructured` — commit con evidencia grep
- [ ] T007 Verificar `ReporteStepUbicacion.tsx` (muerto, fuera de alcance) y anotar para ZEUS

## Fase 4 — US3 Guardas unificadas

- [ ] T008 Crear `src/lib/ai/guardas-decision.ts` (réplica pura de `guardas.ts`, sin `registrarPaso`)
- [ ] T009 Crear `src/lib/ai/guardas-decision.test.ts` de paridad vs `aplicarGuardasSeguridad` (registrarPaso mockeado)
- [ ] T010 Adoptar en `src/lib/ai/sandbox.ts` (esRafaga=false, umbralSpam desde `clasificacion.umbral_spam` default 0.7)
- [ ] T011 Adoptar en `src/lib/ai/eval-runner.ts` (idem)
- [ ] T012 Commit d)

## Fase 5 — Gate y cierre

- [ ] T013 Gate bajo candado: `npx tsc --noEmit` + `npm run lint` + tests tocados + `npm run build`
- [ ] T014 Suite completa una vez, bajo candado; distinguir fallos ajenos en vuelo
- [ ] T015 `cierre.md` + sección Implementación en `spec.md` (commit docs)
