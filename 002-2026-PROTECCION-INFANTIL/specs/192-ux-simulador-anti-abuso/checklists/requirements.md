# Requirements Checklist: SPEC-192 — UX del simulador anti-abuso

## User Stories

- [ ] US1: Reset limpio al cambiar de escenario (I-70)
- [ ] US2: Bypass seguro de `report_fingerprint` mediante secret compartido (I-71)
- [ ] US3: Dropdown de plataformas reales con fallback (I-74)
- [ ] US4: Priorizar arrays sobre campos únicos (I-75)
- [ ] US5: Historial con escenario legible y nota interna (I-76)
- [ ] US6: Botón Iniciar re-habilitado tras corrida (I-77)

## Functional Requirements

- [ ] FR-001: Reset de `run`, `runId`, `error`, `sugerencia` al cambiar escenario
- [ ] FR-002: Variable de entorno `SIMULADOR_ABUSO_SECRET` disponible para app y worker
- [ ] FR-003: Bypass `report_fingerprint` con header `x-simulacion-secret` validado por `crypto.timingSafeEqual`
- [ ] FR-004: Validación del secret estrictamente server-side
- [ ] FR-005: `report` e `report_identificador` no se saltan
- [ ] FR-006: Worker envía header `x-simulacion-secret`
- [ ] FR-007: Worker fail-loud si falta `SIMULADOR_ABUSO_SECRET`
- [ ] FR-008: Dropdown de plataformas con fallback
- [ ] FR-009: Priorización de arrays en payload
- [ ] FR-010: Deshabilitar campo único cuando array tiene contenido
- [ ] FR-011: Historial muestra label del escenario
- [ ] FR-012: Historial muestra nota con tooltip
- [ ] FR-013: Input opcional "Nota (interna)"
- [ ] FR-014: Migración aditiva `nota VARCHAR(200)`
- [ ] FR-015: Botón habilitado tras corrida finalizada
- [ ] FR-016: No tocar `src/lib/ai/**`
- [ ] FR-017: No modificar scopes/límites de `src/lib/rate-limit.ts`

## Success Criteria

- [ ] SC-001: Detalle anterior desaparece al cambiar escenario
- [ ] SC-002: Dos simulaciones seguidas no bloqueadas por fingerprint
- [ ] SC-003: Request público sigue siendo bloqueado por fingerprint
- [ ] SC-004: Request con header falso sigue siendo bloqueado por fingerprint
- [ ] SC-005: Dropdown plataformas funciona con BD o fallback
- [ ] SC-006: Payload usa array cuando ambos campos están llenos
- [ ] SC-007: Historial muestra label legible
- [ ] SC-008: Nota interna persiste y se muestra
- [ ] SC-009: Botón habilitado tras corrida completada
- [ ] SC-010: Gate local completo verde

## Constitution / Candados

- [ ] No se toca `src/lib/ai/**`
- [ ] Migración aditiva únicamente (sin DROP)
- [ ] Sin exposición de bypass fingerprint al público
- [ ] Sin PII de reportes reales en agregados
- [ ] Logs nunca registran el valor del secret
