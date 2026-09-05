# Tasks · SPEC-458 · Alerta

**Status**: DESARROLLO
**Fecha**: 2026-09-04 · **Dev**: Infra (idc-c0)

- [x] T001 Leer radicado + catálogo §3 (Alerta) + molde Button/Badge + tokens del sistema (tailwind.config + globals.css).
- [x] T002 Verificar que `info` se usa en callsites (4+) → los 4 tonos se conservan.
- [x] T003 `.text-estado-cielo` en globals.css (aditivo, reusa `--cielo-700-rgb`).
- [x] T004 Migrar `Alerta.tsx` a tokens por función + icono a la izquierda + `sinIcono`.
- [x] T005 Actualizar `Alerta.test.tsx`: candado al token + contraprueba bidireccional + icono + cero crudos.
- [x] T006 Bajar el piso de `tokens-check.ts` (1038 → 1022) medido sobre origin/main fresco.
- [x] T007 Preflight: tsc + eslint + tokens:check + test de Alerta.
- [ ] T008 Regenerar `specs/README.md` (fila 458 sale sola).
- [ ] T009 arch:check + specs-discipline verdes.
- [ ] T010 Commit + push + PR draft (espera ✅ de Diseño para cerrar).
