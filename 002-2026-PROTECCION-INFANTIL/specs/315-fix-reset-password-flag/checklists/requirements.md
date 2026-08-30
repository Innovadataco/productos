# Specification Quality Checklist: SPEC-315 · Fix reset password flag

**Created**: 2026-08-29 · **Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details más allá del contrato (nombre de método/campo son el bug exacto)
- [x] Focused on user value (usuario real en loop · Jelkin)
- [x] Written for stakeholders (US1 explica el flujo percibido)
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers
- [x] Requirements testable (FR-001-003 atan a campo + comportamiento)
- [x] Success criteria measurable (SC-001 consulta BD `false`, SC-002 sin regresión, SC-003 token inválido)
- [x] Success criteria technology-agnostic (comportamiento observable)
- [x] Acceptance scenarios defined (3 Given/When/Then)
- [x] Edge cases identified (flag ya false idempotente · reset administrativo distinto · usuario borrado)
- [x] Scope bounded (FR-002: solo restablecerPassword · candado 22 v5)
- [x] Dependencies/assumptions identified (campo existe · patrón en :157 · candado 22)

## Feature Readiness

- [x] Todas las FR con criterio de aceptación
- [x] User scenario cubre el flujo principal
- [x] Measurable outcomes definidos
- [x] No implementation leak (el "cómo" exacto es 1 línea · trivial)

## Notes

- Status `PLANEADO` canónico (`specs-discipline.test.ts:12-19`).
- `Impacto en arquitectura:` presente en el header.
- Compuerta §4 LIGERA autorizada por instructivo.
- Candado 24 con aprendizaje SPEC-314: `npm run test` completo antes de reportar (no solo el test nuevo).
