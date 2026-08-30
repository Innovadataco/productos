# Specification Quality Checklist: SPEC-311 · Ficha colegio admin Fase 2

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-29
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — nombres de archivo/clase citados solo cuando son contrato con código existente (`ColegioDetalleSecciones`, `ColegioActividadRepository`, endpoint path); no elección libre
- [x] Focused on user value and business needs — cada US ata a una necesidad concreta del ADMIN (brief §2.1) y a I-98
- [x] Written for non-technical stakeholders — cada US tiene "Why this priority" en lenguaje operativo
- [x] All mandatory sections completed — User Scenarios (4 US), Requirements (20 FR), Success Criteria (SC-001 + SC-006-013), Assumptions

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — decisiones cerradas: mapeo rol usuario tomado del enum RolUsuario directo con fallback anónimo; picoActividad empate → más reciente; edge cases 100% cubiertos con defaults defendibles
- [x] Requirements are testable and unambiguous — cada FR ata a un artefacto concreto (bloque, campo del payload, elemento del DOM)
- [x] Success criteria are measurable — SC-006/007/008/009/010/011/012 con métricas objetivas (contraste 4.5:1, < 800 ms, orden DOM, `git diff package.json`)
- [x] Success criteria are technology-agnostic — SC en términos de comportamiento observable (orden visual, campos presentes, tiempo de respuesta)
- [x] All acceptance scenarios are defined — 4 US con Given/When/Then, cubriendo P1 US1 (Bloque A accionable), P1 US2 (Bloque B analítico), P2 US3 (Bloque C línea tiempo), P1 US4 (regresión nada se pierde)
- [x] Edge cases are identified — 10 edge cases documentados incluyendo colegio sin actividad, 1000+ reportes, asignadoAId NULL, empate picoActividad, ruta admin sin query param (candado 17)
- [x] Scope is clearly bounded — FR-016/017/018 listan explícito lo prohibido; fuera de v1: mapa, PDF, alertas automáticas
- [x] Dependencies and assumptions identified — 12 assumptions incluyendo dependencia Fase 1, coordinación con otros Devs (SPEC-305-310), rutas admin existentes, nota HALLAZGO renumeración SPEC-304→SPEC-311

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — FR-001-020 mapean a al menos una SC o AS
- [x] User scenarios cover primary flows — US1 (Bloque A), US2 (Bloque B), US3 (Bloque C), US4 (regresión SC-006)
- [x] Feature meets measurable outcomes defined in Success Criteria — SC-006 cierra "nada se pierde" · SC-007 cierra "Bloque A operativo" · SC-009 rendimiento · SC-011 orden · SC-013 CTAs funcionales
- [x] No implementation details leak into specification — el "cómo" (query SQL exacta, shape TS del transformador) queda para `plan.md`; la spec cierra el "qué"

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Status `PLANEADO` es canónico según `src/lib/specs-discipline.test.ts:12-19` (verificado — `Desplegado` NO existe).
- Línea `Impacto en arquitectura:` presente en el header (FR-008 SPEC-126 · candado disciplina).
- Compuerta §4 SECA autorizada por CEO IDC según instructivo — Fábrica aprueba rápido si el spec+plan viene limpio.
- Candado 17 D-98 explícito en FR-020 y edge cases; ya invocado en la propia renumeración SPEC-304→SPEC-311.
- Candado 24 D-55 se aplicará en Polish (`npm run lint -- <archivo>` + grep `error` antes de REALIZADO).
- Delta con instructivo: SPEC-304 → SPEC-311. INSTRUCTIVO-002-PI-210 se mantiene. Fábrica confirmó reasignación.
