# Tasks: Mejora del prompt del clasificador (Spec 050)

**Input**: Design documents from `/specs/050-mejora-prompt-clasificador/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, quickstart.md, checklists/requirements.md

**Tests**: Eval harness del Laboratorio IA con set de referencia validado por humanos.

**Organization**: Single User Story with research, design, implementation, and validation phases.

---

## Phase 1: Research (Blocking)

**Purpose**: Confirmar el gap y el criterio de medición antes de diseñar el prompt.

**⚠️ CRITICAL**: No se puede diseñar el prompt sin entender exactamente qué falla y contra qué se medirá.

- [ ] T001 [P] Verificar en `src/lib/ai/classifier.ts` la definición actual de `SOLICITUD_MATERIAL` y `OFRECIMIENTO_REGALOS`.
- [ ] T002 [P] Verificar el ejemplo problemático `"te compro un celular si me mandas fotos" → OFRECIMIENTO_REGALOS` en `buildSystemPrompt`.
- [ ] T003 [P] Verificar la definición actual de `CONTACTO_INSISTENTE` en `buildSystemPrompt`.
- [ ] T004 [P] Consultar el Laboratorio IA / eval-results para extraer el recall de `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE` en los modelos probados (qwen2.5:32b, ornith:9b, ornith:35b).
- [ ] T005 [P] Identificar si existe un set de `casoEval` o reportes corregidos por humanos que sirva como referencia.
- [ ] T006 [NEEDS CLARIFICATION] Confirmar con el owner/operador el criterio de aceptación y el tamaño mínimo del set de referencia.

**Checkpoint**: Research complete — gap confirmado, criterio de medición definido o marcado como bloqueador.

---

## Phase 2: Design (Blocking)

**Purpose**: Redactar el prompt propuesto y los ejemplos contrastivos.

**⚠️ CRITICAL**: No se puede implementar sin un prompt aprobado.

- [ ] T007 [P] Redactar la regla de prioridad para `SOLICITUD_MATERIAL` vs `OFRECIMIENTO_REGALOS`.
- [ ] T008 [P] Redactar la ampliación de `CONTACTO_INSISTENTE` con señales de grooming temprano.
- [ ] T009 [P] Diseñar 2-3 ejemplos contrastivos para `CONTACTO_INSISTENTE` vs `OTRO`.
- [ ] T010 [P] Revisar que el prompt no altere las otras 10 categorías ni sus fronteras.
- [ ] T011 [P] Estimar el aumento de tokens/latencia del nuevo prompt.
- [ ] T012 [P] Documentar el prompt propuesto textualmente en `spec.md`.

**Checkpoint**: Design complete — prompt propuesto en `spec.md`, riesgos documentados.

---

## Phase 3: User Story 1 — Ajuste quirúrgico del prompt (Priority: P1) 🎯 MVP

**Goal**: Reemplazar el `basePrompt` de `buildSystemPrompt` con el texto diseñado, manteniendo intacto el resto del código.

**Independent Test**: Ejecutar el Laboratorio IA con el set de referencia validado y comparar métricas antes/después.

### Tests for User Story 1

- [ ] T013 [P] [US1] Eval: medir baseline con el prompt actual en el set de referencia humano.
- [ ] T014 [P] [US1] Eval: medir con el nuevo prompt en el mismo set de referencia.
- [ ] T015 [P] [US1] Eval: reportar recall/precisión por categoría, con énfasis en `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE`.
- [ ] T016 [P] [US1] Eval: verificar que las otras 10 categorías no regresan más del umbral aceptable.
- [ ] T017 [P] [US1] Smoke test: sandbox con `"te compro un celular si me mandas fotos"` → `SOLICITUD_MATERIAL`.
- [ ] T018 [P] [US1] Smoke test: sandbox con grooming temprano → `CONTACTO_INSISTENTE`.

### Implementation for User Story 1

- [ ] T019 [US1] Reemplazar `basePrompt` en `src/lib/ai/classifier.ts` con el texto propuesto en `spec.md`.
- [ ] T020 [US1] Verificar que no se modifica `classificationResponseSchema`, `OllamaMetrics`, `DEFAULT_VOTING_CONFIG`, `clasificarConVotos` ni `desempatarConModeloGrande`.
- [ ] T021 [US1] Verificar que no se modifica el cierre "Responde SOLO el JSON..." ni la concatenación de ejemplos corregidos.
- [ ] T022 [US1] Ejecutar `npx tsc --noEmit` y `npm run lint`.
- [ ] T023 [US1] Ejecutar `npm run test` para asegurar que no hay regresiones en tests unitarios.

**Checkpoint**: User Story 1 implemented — prompt cambiado, build/test OK, eval en curso.

---

## Phase 4: Validation & Decision

**Purpose**: Medir el cambio y decidir si se mantiene, itera o revierte.

- [ ] T024 [P] Ejecutar el eval completo con el nuevo prompt.
- [ ] T025 [P] Comparar métricas contra baseline.
- [ ] T026 [P] Medir latencia promedio y p95 del nuevo prompt.
- [ ] T027 [P] Documentar resultados en `cierre.md` o en el spec de ajuste correspondiente.
- [ ] T028 [P] Decisión con el owner: aprobar, iterar o revertir.
- [ ] T029 [P] Si se aprueba, ejecutar `./scripts/dev-restart.sh`.
- [ ] T030 [P] Si se revierte, ejecutar `git revert` y `./scripts/dev-restart.sh`.

---

## Phase 5: Spec-Kit Closure

**Purpose**: Completar documentación y commit evidence.

- [ ] T031 Update `spec.md` Implementación section with summary of changes and final decision.
- [ ] T032 Create `cierre.md` with evidence: git log, files touched, eval results, deploy status.
- [ ] T033 Commit per phase + one docs commit, push to `feature/001-scaffolding`.
- [ ] T034 Update Status to `CERRADA` (solo si la validación es exitosa; si no, dejar `PLANEADO` o `PENDIENTE DE PRUEBA` con deuda documentada).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Research)**: No dependencies. Blocks Phase 2.
- **Phase 2 (Design)**: Depends on Phase 1. Blocks Phase 3.
- **Phase 3 (US1 Implementation)**: Depends on Phase 2. Blocks Phase 4.
- **Phase 4 (Validation)**: Depends on Phase 3. Blocks Phase 5.
- **Phase 5 (Closure)**: Depends on Phase 4.

### User Story Dependencies

- **US1 (Ajuste del prompt)**: Can start after Phase 2. Requires the prompt approved.

### Parallel Opportunities

- T001-T006 (Research): All parallel except T006 depends on T005.
- T007-T012 (Design): All parallel.
- T013-T018 (Tests): Can be drafted in parallel after design, but execution depends on T019-T023.
- T024-T030 (Validation): Sequential.

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1: Research.
2. Complete Phase 2: Design.
3. **STOP and VALIDATE**: Get human approval for the proposed prompt and the reference dataset.
4. Complete Phase 3: Implement the prompt change.
5. Complete Phase 4: Measure and decide.

### Incremental Delivery

1. Research → Gap confirmed.
2. Design → Prompt proposed and approved.
3. Implementation → Single file change.
4. Validation → Eval against human-validated data.
5. Decision → Approve, iterate, or revert.
6. Closure → Document evidence.

---

## Notes

- No new files are created; only `src/lib/ai/classifier.ts` is modified.
- No database migration is required.
- The validation is the critical path: without a human-validated reference set, the implementation cannot be approved.
- If the prompt change does not improve the metrics, the commit is reverted and the spec is closed as "deuda técnica / opción descartada".
