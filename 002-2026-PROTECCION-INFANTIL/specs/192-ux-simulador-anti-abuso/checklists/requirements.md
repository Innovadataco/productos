# Requirements Checklist: SPEC-192 — UX del simulador anti-abuso

## User Stories

- [ ] US1: Reset limpio al cambiar de escenario (I-70)
- [ ] US2: Bypass seguro de `report_fingerprint` para simulaciones ADMIN (I-71)
- [ ] US3: Dropdown de plataformas reales con fallback (I-74)
- [ ] US4: Priorizar arrays sobre campos únicos (I-75)
- [ ] US5: Historial con escenario legible y nota interna (I-76)
- [ ] US6: Botón Iniciar re-habilitado tras corrida (I-77)

## Functional Requirements

- [ ] FR-001: Reset de `run`, `runId`, `error`, `sugerencia` al cambiar escenario
- [ ] FR-002: Bypass `report_fingerprint` con `x-simulacion: true` + ADMIN
- [ ] FR-003: Validación ADMIN server-side del bypass
- [ ] FR-004: `report` e `report_identificador` no se saltan
- [ ] FR-005: Worker envía header `x-simulacion: true`
- [ ] FR-006: Dropdown de plataformas con fallback
- [ ] FR-007: Priorización de arrays en payload
- [ ] FR-008: Deshabilitar campo único cuando array tiene contenido
- [ ] FR-009: Historial muestra label del escenario
- [ ] FR-010: Historial muestra nota con tooltip
- [ ] FR-011: Input opcional "Nota (interna)"
- [ ] FR-012: Migración aditiva `nota VARCHAR(200)`
- [ ] FR-013: Botón habilitado tras corrida finalizada
- [ ] FR-014: No tocar `src/lib/ai/**`
- [ ] FR-015: No modificar scopes/límites de `src/lib/rate-limit.ts`

## Success Criteria

- [ ] SC-001: Detalle anterior desaparece al cambiar escenario
- [ ] SC-002: Dos simulaciones seguidas no bloqueadas por fingerprint
- [ ] SC-003: Request público sigue siendo bloqueado por fingerprint
- [ ] SC-004: Dropdown plataformas funciona con BD o fallback
- [ ] SC-005: Payload usa array cuando ambos campos están llenos
- [ ] SC-006: Historial muestra label legible
- [ ] SC-007: Nota interna persiste y se muestra
- [ ] SC-008: Botón habilitado tras corrida completada
- [ ] SC-009: Gate local completo verde

## Constitution / Candados

- [ ] No se toca `src/lib/ai/**`
- [ ] Migración aditiva únicamente (sin DROP)
- [ ] Sin exposición de bypass fingerprint al público
- [ ] Sin PII de reportes reales en agregados
