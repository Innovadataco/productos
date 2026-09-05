# SPEC-487 · Tasks

## Hecho (este PR)
- [x] Verificar en fuente los 3 gates + cómo se escriben los generados (candado 15 v5).
- [x] `generar-readme.ts`: modo `--check-representable` (fuente sana, no committed==regen); `verificarRepresentable(dirSpecs?)` parametrizable para el candado.
- [x] `arch:check (a)`: representabilidad para 02-roles/03-pantallas (byte-exactos siguen igual); quitar import ahora inerte `diferenciasTolerandoOrden`.
- [x] `specs-discipline.test.ts`: aserción «índice cubre carpetas» → «ninguna carpeta a medio crear».
- [x] `ci.yml`: el gate `verificaciones` usa `--check-representable`.
- [x] Workflow `generados-post-merge.yml` (flujo B): push a main + path-filter + cancel-in-progress:true + workflow_dispatch; bot pushea, operador abre PR.
- [x] Candado `generados-post-merge.candado.test.ts` (5 tests: merge real + contraprueba + representabilidad + determinismo). Registrado en `vitest.unit.includes.ts`.
- [x] Preflight: tsc + eslint + tokens:check + arch:check + generar-readme --check-representable + specs-discipline + suite unit.

## Pendiente
- [ ] Commit + push + PR + reportar al CEO. Al verde, el CEO mergea por run-id y verifica que un par de PR reales dejan de tocar los generados.

## Fuera de alcance
- Byte-exactos (00/01/06), `vitest.unit.includes.ts` (union), retirar `merge=union` (follow-up).
