# Checklist de requisitos — Spec 080

**Spec**: `specs/080-orden-migraciones-colegio/spec.md` · **Fecha**: 2026-07-22

## Completitud del contenido

- [x] Sin detalles de implementación en los requisitos (el "qué", no el "cómo" en FRs).
- [x] User Stories priorizadas (P1/P2) e independientemente testeables.
- [x] Acceptance Scenarios en formato Given/When/Then.
- [x] Edge Cases identificados (BD con datos, checksums, CI, migraciones intermedias).
- [x] FRs medibles y numerados (FR-001 a FR-006).
- [x] Success Criteria medibles (SC-001 a SC-004).

## Calidad de los requisitos

- [x] Sin marcadores [NEEDS CLARIFICATION] pendientes.
- [x] Alcance explícito: solo reordenamiento; esquema final sin cambios (FR-003).
- [x] Excepción a la regla "migraciones aditivas" justificada y acotada a desarrollo.
- [x] Criterios de validación alineados con el brief de ZEUS (reset, seed, gate).
- [x] Dependencias verificadas en el código real (Pais/Ciudad previas; add_departamento sin dependencias intermedias).

## Listo para planificación

- [x] Plan generado (`plan.md`) con análisis de alternativas y riesgos.
- [ ] Aprobación de ZEUS (PENDIENTE — no implementar antes).
