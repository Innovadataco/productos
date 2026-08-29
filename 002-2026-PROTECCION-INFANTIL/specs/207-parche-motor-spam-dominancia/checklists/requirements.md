# Checklist de requisitos — SPEC-207

## Funcionales

- [ ] FR-001: `spam.dominancia_umbral=0.33` en seed.
- [ ] FR-002: `spam.dominios_acortadores` JSON en seed.
- [ ] FR-003: Hard-rule con 4 señales y umbral ≥2.
- [ ] FR-004: Hard-rule ANTES de guarda dominancia.
- [ ] FR-005: `reglaAplicada = "spam_publicitario_deterministico"`.
- [ ] FR-006: Log de modelo sin respuesta.
- [ ] FR-007: Sin schema/migración.
- [ ] FR-008: Sin cambios UI.

## No funcionales

- [ ] NFR-001: Hard-rule <50 ms.
- [ ] NFR-002: Cero PII adicional.
- [ ] NFR-003: Gate local verde.

## Success Criteria

- [ ] SC-001: RPT-QFUHE8 → `POSIBLE_SPAM`.
- [ ] SC-002: 1 hashtag sin link → NO hard-rule.
- [ ] SC-003: `spam.dominancia_umbral=0.33` en BD.
- [ ] SC-004: Log de modelo sin respuesta.
- [ ] SC-005: Test unitario con mock LLM.
