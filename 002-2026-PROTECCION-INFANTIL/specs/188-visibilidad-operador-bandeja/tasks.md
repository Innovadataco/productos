# Tareas: SPEC-188 — Visibilidad del operador en la bandeja (002-PI-083)

## Fase 1: Especificación (compuerta §4)

- [x] T001 Redactar `spec.md` con requisitos, escenarios y decisiones propuestas.
- [x] T002 Redactar `plan.md` con diseño técnico y riesgos.
- [x] T003 Redactar `data-model.md`, `research.md` y `checklists/requirements.md`.
- [x] T004 Commit + push de `work/002-pi-083`.
- [x] T005 Señal a ZEUS: `002-PI-083 · SPEC-188 · spec+plan LISTO · PARA`.

## Fase 2: Implementación (post-aprobación ZEUS)

- [x] T006 Extender DTO de bandeja con `operadorId`/`operadorEmail`.
- [x] T007 Añadir columna "Operador" en `AdminReportesTable.tsx`.
- [x] T008 Añadir filtro dropdown "Operador" en `AdminReportesTable.tsx`.
- [x] T009 Añadir método `findAsignacionesReporte` en `AuditLogRepository`.
- [x] T010 Enriquecer `timeline-proceso.ts` con eventos de asignación.
- [x] T011 Renderizar eventos de asignación en UI "Ver proceso".
- [x] T012 Tests: filtro por operador, columna, timeline.
- [x] T013 Gate local: tsc, lint --no-cache, arch:check, tests, build.
- [x] T014 Commit + push + PR a `feature/001-scaffolding`.

## Fase 3: Cierre

- [x] T015 Actualizar `spec.md` con sección Implementación y estado IMPLEMENTADO.
- [x] T016 Crear `cierre.md` con evidencia.
- [x] T017 Registrar SPEC-188 en `specs/README.md` (ambas tablas).
