# Tasks · SPEC-400b · análisis guardias `/api/**`

**Status**: DESARROLLO
**Fecha**: 2026-09-04 · **Dev**: Infra (idc-c0)

- [x] T001 Leer `middleware.ts:192-296` para caracterizar el fail-open con precisión.
- [x] T002 Localizar helpers reales de `guardias.ts` + `roles-titulares.ts` para reusar (no duplicar).
- [x] T003 Escribir `scripts/arch/generar-guardias-api.ts` con enumeración completa de `/api/**` + evaluación por ruta + veredicto fail-closed + matriz cookie-ausente.
- [x] T004 Registrar el nuevo artefacto en `scripts/arch/artefactos.ts` (fila `04-guardias-api.md`).
- [x] T005 Primera generación local — verificar 385 rutas, 12 `decidir` (pagos/suscripción, coincide con anticipación del CEO).
- [x] T006 Regenerar `00-INDICE.md` para incluir la nueva fila.
- [x] T007 `npm run arch:check` verde local (integra el drift check del nuevo artefacto).
- [ ] T008 Regenerar `specs/README.md` con el generador de SPEC-413 (la fila 400b sale sola).
- [ ] T009 `tsc` + `lint` limpios local.
- [ ] T010 Escribir `spec.md`, `plan.md`, `tasks.md`.
- [ ] T011 Commit + push + PR (`work/pi-SPEC-400b-analisis-guardias-api`).
- [ ] T012 CI verde.
