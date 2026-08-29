# Checklist de requisitos: SPEC-145 — Modelo `Profesor` mínimo

**Spec**: [../spec.md](../spec.md) · **Fecha**: 2026-08-03

## Completitud del contenido

- [x] User Stories con Priority, Why, Independent Test y Acceptance Scenarios (US1–US3)
- [x] Edge Cases (drift I-49, cross-tenant, baja con cursos, enum ADD VALUE)
- [x] Functional Requirements "FR-XXX: El sistema DEBE…" (FR-001…FR-013)
- [x] Key Entities (Profesor, Curso extendido)
- [x] Success Criteria medibles (SC-001…SC-006)
- [x] Assumptions explícitas (sin UI, patrón CRUD, estado String, cargas = test only)
- [x] Línea "Impacto en arquitectura" presente (modelo nuevo ⇒ regenerar
      `01-modelo-datos.md` + `arch:check`)

## Alineación con fuentes vinculantes

- [x] Brief §7.2: campos mínimos, relación aditiva sin retro-asignación, soft delete,
      sin overdiseño (FR-001/002)
- [x] Brief §7.4: tenant-first E-1 (FR-006), migración aditiva/reversible (FR-003),
      I-29 (FR-013)
- [x] Brief §3: "profesor" en código y rutas (assumption + FR-005)
- [x] Cargas del REVISO 157: O-2 (FR-010), O-1 (FR-011), I-49 (FR-003/SC-001)
- [x] Lo no fijado va como decisión a ZEUS (D1), no inventado

## Calidad

- [x] Cada FR es testeable (quickstart por punto)
- [x] Sin contradicciones internas (D1 explícita; default recomendado declarado)
- [x] Cero secretos o valores sensibles (I-22)

## Compuerta §4 — RESUELTA (ZEUS, 2026-08-03: REVISO `acb02777` → CUMPLE)

- [x] D1 = A: endpoints de curso aceptan `profesorTitularId?` YA con validación
      same-tenant (propiedad de seguridad cross-tenant)
- [x] CONDICIÓN 1: test negativo explícito (profesor de B a curso de A falla)
- [x] CONDICIÓN 2: baja suave del titular CONSERVA la asignación (FR-014 + test)
- [x] Cuidado ADD VALUE documentado (no usar el valor en la misma migración)
- [x] Sigue: `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`
