# Checklist de requisitos: SPEC-144 — Modelo `Estudiante` expandido

**Spec**: [../spec.md](../spec.md) · **Fecha**: 2026-08-03

## Completitud del contenido

- [x] User Stories con Priority, Why, Independent Test y Acceptance Scenarios (US1–US3)
- [x] Edge Cases documentados (backfill, locks PG16, plantilla vieja, worker, enum)
- [x] Functional Requirements "FR-XXX: El sistema DEBE…" (FR-001…FR-012)
- [x] Key Entities identificadas
- [x] Success Criteria medibles (SC-001…SC-006)
- [x] Assumptions explícitas
- [x] Línea "Impacto en arquitectura" presente (modifica modelo de datos ⇒ regenerar
      `01-modelo-datos.md` + `arch:check`)

## Alineación con fuentes vinculantes

- [x] Brief §7.1: rename con `@@map`, campos, backfill idempotente, hasta 2 acudientes
- [x] Brief §7.4: tenant-first E-1 (FR-009), migraciones aditivas/reversibles (FR-006),
      `withUnitOfWork` en escritura multi-entidad (contracts), I-29 (FR-012)
- [x] Brief §3: terminología gobierna el código (US1, FR-008)
- [x] Constitución §2.3 / §3.1 / §3.2 / §3.6 verificadas en Constitution Check (plan.md)
- [x] Lo no fijado por el brief va como decisión a ZEUS (D1–D4), no inventado

## Calidad

- [x] Cada FR es testeable y tiene anclaje de código o verificación
- [x] Sin contradicciones internas (D4 marcado como pendiente, no resuelto a escondidas)
- [x] Sin detalles de implementación en spec.md más allá de lo vinculante del brief
- [x] Cero secretos o valores sensibles (I-22)

## Compuerta §4 — RESUELTA (ZEUS, 2026-08-03: REVISO `683494cb` → CUMPLE)

- [x] D1 = tabla hija `AcudienteEstudiante` (condición: nunca por id suelto, siempre
      vía estudiante acotado por `colegioId`)
- [x] D2 = paths conservados; `/estudiantes/*` con redirects llega en SPEC-146/147
- [x] D3 = String + set Zod **RC, TI, CC, CE, PASAPORTE, OTRO** (RC añadido por ZEUS)
- [x] D4 = fila marcada en "filas con problemas", archivo nunca rechazado;
      `apellidos = ""` solo para backfill histórico
- [x] Sigue: `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`
