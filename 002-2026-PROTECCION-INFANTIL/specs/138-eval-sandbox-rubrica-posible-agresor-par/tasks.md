# Tasks: SPEC-138 — Eval/sandbox rúbrica + posibleAgresorPar

**Input**: plan.md + spec.md (APROBADO por ZEUS 2026-08-02, con CI verde: respuestas
EXISTENTES de la rúbrica, conservador, sin preguntas nuevas, decisión de conducta intacta).

## Fase 1 — Selector de motor unificado (FR-001/FR-002)

- [x] T001 Extraer el selector de `clasificacion.ts` a función compartida
      (`clasificarConMotorActivo` o equivalente en `src/lib/ai/`)
- [x] T002 `sandbox.ts` y `eval-runner.ts` usan el selector (legacy intacto con flag off)
- [x] T003 Corridas nuevas registran `motorUsado` (lectura tolerante de históricos)
- [x] T004 Tests del selector: flag on → rúbrica; flag off → legacy (ambos contextos)

## Fase 2 — `posibleAgresorPar` calculado (FR-003/FR-004)

- [x] T005 Regla de derivación: NO CALCULABLE conservadoramente (preguntas solo en positivo) → NEEDS CLARIFICATION → ZEUS decide (c): queda false documentado
- [x] T006 `leerPosibleAgresorPar` tolerante en `motor.ts` (false documentado; legacy propaga el real)
- [x] T007 eval-runner conserva false en la rama sin evidencia (§1.3); el legacy reporta el valor real
- [x] T008 Tests del selector y del guard tolerante (motor.test.ts, 5/5)

## Fase 3 — Gates y cierre

- [x] T009 Suite completa + tsc + lint + build + arch:check verdes; decisión de conducta intacta
- [x] T010 Cierre documental: spec.md (Status + §Implementación), checklist, specs/README.md
