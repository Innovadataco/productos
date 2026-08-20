# Tareas: SPEC-187 — Override de modelo para smoke Ollama (002-PI-082)

## Fase 1: Especificación (compuerta §4)

- [x] T001 Redactar `spec.md` con requisitos, escenarios y decisiones propuestas.
- [x] T002 Redactar `plan.md` con diseño técnico y riesgos.
- [x] T003 Redactar `data-model.md`, `research.md` y `checklists/requirements.md`.
- [ ] T004 Commit + push de `work/002-pi-082`.
- [ ] T005 Señal a ZEUS: `002-PI-082 · SPEC-187 · spec+plan LISTO · PARA`.

## Fase 2: Implementación (post-aprobación ZEUS)

- [ ] T006 Modificar `src/lib/monitoreo/probes.ts` para leer override y aplicar fallback.
- [ ] T007 Añadir parámetro `monitoreo.ollama.smoke.modelo` en `prisma/seed.ts`.
- [ ] T008 Actualizar `src/lib/monitoreo/probes.test.ts` con tests de override y fallback.
- [ ] T009 Gate local: tsc, lint, arch:check, tests, build.
- [ ] T010 Commit + push + PR a `feature/001-scaffolding`.

## Fase 3: Cierre

- [ ] T011 Actualizar `spec.md` con sección Implementación y estado IMPLEMENTADO.
- [ ] T012 Crear `cierre.md` con evidencia.
- [ ] T013 Registrar SPEC-187 en `specs/README.md` (ambas tablas).
