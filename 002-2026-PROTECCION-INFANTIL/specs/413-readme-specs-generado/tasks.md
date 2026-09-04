# Tasks · SPEC-413 · Índice de specs generado

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (idc-c0)

- [x] T001 Revisar formato del README actual y del generador de referencia (`scripts/arch/generar-roles-capacidades.ts`).
- [x] T002 Escribir `scripts/specs/generar-readme.ts` con modos default y `--check`; catálogo canónico + sinónimos + degradado suave para "fuera de catálogo".
- [x] T003 Meter marcadores en `specs/README.md` preservando prólogo y secciones narrativas.
- [x] T004 Primera regeneración local; verificar contadores del resumen y orden de la tabla.
- [x] T005 Verificar `--check` (verde tras generar, rojo tras drift intencional dentro de la tabla, verde tras revertir).
- [x] T006 Añadir step `npx tsx scripts/specs/generar-readme.ts --check` al final de `verificaciones` en `ci.yml`.
- [x] T007 `specs-discipline.test.ts` sigue verde local.
- [ ] T008 Escribir spec + plan + tasks para SPEC-413.
- [ ] T009 Commit + push + PR con nombre correcto de rama (`work/pi-SPEC-413-readme-specs-generado`).
- [ ] T010 Verificar CI del PR verde (incluye el nuevo `--check`).
