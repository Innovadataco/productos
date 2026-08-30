# Specification Quality Checklist: SPEC-303 · Ficha colegio admin Fase 1

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-29
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — nombres de archivo/clase citados solo cuando son contrato con código existente (repos DAL, endpoints, componentes UI ya presentes); no elección libre
- [x] Focused on user value and business needs — cada US ata a una pregunta del ADMIN (brief §1) y a I-98/I-104
- [x] Written for non-technical stakeholders — cada US tiene "Why this priority" en lenguaje de negocio
- [x] All mandatory sections completed — User Scenarios, Requirements, Success Criteria, Assumptions

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — las 4 zonas de decisión del instructivo se cerraron en la spec (criterio combinado = UNIÓN dedup por Reporte.id; casos abiertos = alertas no-cerradas + expedientes activos; rango default = `analytics.colegios.periodo_default_dias`; semáforo per-fila independiente del paginado)
- [x] Requirements are testable and unambiguous — cada FR ata a un artefacto concreto y a al menos una SC o Acceptance Scenario
- [x] Success criteria are measurable — SC-001 a SC-010 con umbrales (segundos, porcentajes, ratios de contraste, "> 0")
- [x] Success criteria are technology-agnostic (no implementation details) — SC en términos de comportamiento observable ("leyenda visible sin hover", "el número coincide", "test A/B cero cross-leak"); referencias a tokens PI son contrato de diseño, no tecnología
- [x] All acceptance scenarios are defined — 3 User Stories con Given/When/Then, cubriendo P1 US1 (ficha), P1 US2 (listado), P2 US3 (afine sin deploy)
- [x] Edge cases are identified — 9 edge cases documentados incluyendo colegio sin actividad, reporte duplicado por rutas, tenant compartido, umbral hostil (0 o negativo), > 50% en rojo
- [x] Scope is clearly bounded — FR-014/FR-016/FR-017/FR-018 listan explícito lo prohibido; Fase 2 fuera de alcance
- [x] Dependencies and assumptions identified — 10 assumptions incluyendo delta `colegios.semaforo.*` → `analytics.colegios.*`, coordinación Dev PI-2, patrón de load de ficha

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — FR-001-018 mapean a al menos una SC o AS
- [x] User scenarios cover primary flows — US1 (ficha 45-alertas), US2 (listado con leyenda), US3 (afine sin deploy)
- [x] Feature meets measurable outcomes defined in Success Criteria — SC-001 cierra el defecto de I-98 en Fase 1; SC-002-004 cierran I-104; SC-005 es candado post-deploy; SC-006-010 cubren robustez
- [x] No implementation details leak into specification — el "cómo" (SQL exacto de las 3 rutas, shape del payload) queda para `plan.md`; la spec cierra el "qué"

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Status `PLANEADO` es canónico según `src/lib/specs-discipline.test.ts:12-19` (verificado — `Desplegado` NO existe).
- Línea `Impacto en arquitectura:` presente en el header (FR-008 SPEC-126 · candado disciplina).
- La decisión de reutilizar `analytics.colegios.*` en vez de crear `colegios.semaforo.*` paralelo se comunica a Fábrica en la señal `spec+plan LISTO` como delta razonado, no como desviación arbitraria (evita fragmentación con 5 keys existentes ya en prod).
