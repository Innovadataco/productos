# SPEC-357 · Tasks

- [X] T001 Leer I-254 y el inventario de Calidad; enumerar 22v5 callsites y handlers afectados
- [X] T002 [FR-001] Exentar `/dashboard/colegio/suscripcion` del guardián del camino (guardias.ts) + fila en NUNCA_TAPADAS_COLEGIO
- [X] T003 [FR-001] `/camino/colegio/plan`: la doble valla no rebota si el colegio está vencido
- [X] T004 [FR-002] `existeSuscripcionVigenteParaTitular` con estado Y fecha + 2 tests (ACTIVA vencida no bloquea; EN_GRACIA y PENDIENTE sí)
- [X] T005 [FR-003] `src/lib/colegio/vigencia-camino.ts` — fuente única de la excepción, acotada a `vencido` + SCHOOL_ADMIN
- [X] T006 [FR-003] Aplicar el helper a los 28 handlers de las 5 familias del camino
- [X] T007 [FR-004] `vigencia-camino.test.ts`: 4 casos (en camino / camino cerrado / vigente / inactivo)
- [X] T008 [24v2] Actualizar los 4 tests que afirmaban "vencido → 403" con las dos mitades; fixture compartido `terminarCaminoColegio`/`vencerColegio`
- [X] T009 Gate: tsc, lint, unit 1925, integración 472/472 de las familias tocadas, build, arch:check
- [X] T010 Disciplina de specs (fila README, Status, cierre) + PR
