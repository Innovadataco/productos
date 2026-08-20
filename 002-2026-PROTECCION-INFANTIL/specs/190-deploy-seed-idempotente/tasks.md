# Tareas: SPEC-190 — Deploy ejecuta seed idempotente (002-PI-085)

## Fase 1: Especificación (compuerta §4)

- [x] T001 Redactar `spec.md` con requisitos, escenarios y decisiones propuestas.
- [x] T002 Redactar `plan.md` con diseño técnico y riesgos.
- [x] T003 Redactar `data-model.md`, `research.md` y `checklists/requirements.md`.
- [x] T004 Commit + push de `work/002-pi-085`.
- [x] T005 Señal a ZEUS: `002-PI-085 · SPEC-190 · spec+plan LISTO · PARA`.

## Fase 2: Implementación (post-aprobación ZEUS)

- [ ] T006 Añadir ejecución del seed en `scripts/deploy-prod.sh` (entre migraciones y sync módulos).
- [ ] T007 Auditar `prisma/seed.ts`: asegurar `update: {}` en parámetros viejos y comentarios en excepciones.
- [ ] T008 Verificar/ajustar logs identificables por sección del seed.
- [ ] T009 Gate local: tsc, lint --no-cache, arch:check, tests, build.
- [ ] T010 Simular deploy idempotente: correr seed dos veces, conservar custom, crear faltante.
- [ ] T011 Commit + push + PR a `feature/001-scaffolding`.

## Fase 3: Cierre

- [ ] T012 Actualizar `spec.md` con sección Implementación y estado IMPLEMENTADO.
- [ ] T013 Crear `cierre.md` con evidencia del doble deploy y archivos tocados.
- [ ] T014 Registrar SPEC-190 en `specs/README.md` (ambas tablas).
