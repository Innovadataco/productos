# Tareas: SPEC-187 — Override de modelo para smoke Ollama (002-PI-082)

## Fase 1: Especificación (compuerta §4) — APROBADA

- [x] T001 Redactar `spec.md` con requisitos, escenarios y decisiones propuestas.
- [x] T002 Redactar `plan.md` con diseño técnico y riesgos.
- [x] T003 Redactar `data-model.md`, `research.md` y `checklists/requirements.md`.
- [x] T004 Commit + push inicial de `work/002-pi-082`.
- [x] T005 Señal a ZEUS: `002-PI-082 · SPEC-187 · spec+plan LISTO · PARA`.
- [x] T006 Actualizar spec/plan con Bloque G aprobado por ZEUS.

## Fase 2: Implementación

- [x] T007 Modificar `src/lib/monitoreo/probes.ts` para leer override y aplicar fallback.
- [x] T008 Añadir parámetro `monitoreo.ollama.smoke.modelo` en `prisma/seed.ts` (bloque viejos, `update: {}`).
- [x] T009 Verificar/corregir otras secciones "viejos" del seed para que usen `update: {}`.
- [x] T010 Actualizar `src/lib/monitoreo/probes.test.ts` con tests de override y fallback.
- [x] T011 Crear `src/lib/seed-idempotencia.test.ts`.
- [x] T012 Gate local: tsc, lint --no-cache, arch:check, tests, build.
- [ ] T013 Commit + push + PR a `feature/001-scaffolding`.

## Fase 3: Cierre

- [ ] T014 Actualizar `cierre.md` con evidencia.
- [ ] T015 Registrar SPEC-187 en `specs/README.md` (ambas tablas).
