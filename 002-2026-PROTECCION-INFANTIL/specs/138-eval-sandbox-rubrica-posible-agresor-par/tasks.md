# Tasks: SPEC-138 — Eval/sandbox rúbrica + posibleAgresorPar

**Input**: plan.md + spec.md (APROBADO por ZEUS 2026-08-02, con CI verde: respuestas
EXISTENTES de la rúbrica, conservador, sin preguntas nuevas, decisión de conducta intacta).

## Fase 1 — Selector de motor unificado (FR-001/FR-002)

- [ ] T001 Extraer el selector de `clasificacion.ts` a función compartida
      (`clasificarConMotorActivo` o equivalente en `src/lib/ai/`)
- [ ] T002 `sandbox.ts` y `eval-runner.ts` usan el selector (legacy intacto con flag off)
- [ ] T003 Corridas nuevas registran `motorUsado` (lectura tolerante de históricos)
- [ ] T004 Tests del selector: flag on → rúbrica; flag off → legacy (ambos contextos)

## Fase 2 — `posibleAgresorPar` calculado (FR-003/FR-004)

- [ ] T005 Regla de derivación conservadora sobre respuestas existentes de vínculo
      (adulto/desconocido → false; no-adulto explícito → true; sin evidencia → false, §1.3)
- [ ] T006 `ResultadoRubrica.posibleAgresorPar` + propagación (`leerPosibleAgresorPar`)
- [ ] T007 `eval-runner.ts:349` deja el hardcodeo: usa el valor real (`posibleAgresorParRate`)
- [ ] T008 Tests unitarios de la regla (adulto / par / sin evidencia)

## Fase 3 — Gates y cierre

- [ ] T009 Suite completa + tsc + lint + build + arch:check verdes; decisión de conducta intacta
- [ ] T010 Cierre documental: spec.md (Status + §Implementación), checklist, specs/README.md
