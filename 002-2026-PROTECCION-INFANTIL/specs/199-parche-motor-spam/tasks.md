# Tareas: SPEC-199 — Parche motor SPAM (002-PI-093)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1: Preparación

- [ ] T001 [P1] Actualizar `.specify/feature.json` a `specs/199-parche-motor-spam`.
- [ ] T002 [P1] Actualizar `specs/README.md` con fila de SPEC-199.

## Fase 2: Fix A — Rúbrica y seed

- [ ] T003 [P1] `src/lib/ai/rubrica-semilla.ts`: añadir bloque SPAM con 5 preguntas.
- [ ] T004 [P1] `src/lib/ai/rubrica-semilla.ts`: endurecer pregunta 2 de OFRECIMIENTO_REGALOS.
- [ ] T005 [P1] `prisma/seed.ts`: forzar update de `ia.rubrica.preguntas` con comentario justificativo.
- [ ] T006 [P1] `prisma/seed.ts`: añadir `spam.dominancia_umbral` y `spam.dominancia_categoria_grave_severidad_min`.

## Fase 3: Fix C — Guarda dominancia SPAM

- [ ] T007 [P1] `src/lib/ai/guardas-decision.ts`: extender firma con `categoriasSecundarias`, umbrales y función de severidad.
- [ ] T008 [P1] `src/lib/ai/guardas-decision.ts`: implementar guarda `spam_dominancia`.
- [ ] T009 [P1] `src/lib/dal/services/reporte-processing/guardas.ts`: pasar categorías secundarias y leer params.
- [ ] T010 [P1] `src/lib/ai/sandbox.ts`: actualizar llamada a `decidirGuardasSeguridad`.

## Fase 4: Tests

- [ ] T011 [P1] `src/lib/ai/guardas-decision.test.ts`: tests de dominancia SPAM y ajuste de llamadas.
- [ ] T012 [P1] Test de aceptación: publicidad → POSIBLE_SPAM; extorsión → conserva grave.

## Fase 5: Gate y cierre

- [ ] T013 [P1] Gate local completo (`tsc`, `lint`, `arch:check`, tests, `build`).
- [ ] T014 [P1] Push único y CI verde 6/6.
