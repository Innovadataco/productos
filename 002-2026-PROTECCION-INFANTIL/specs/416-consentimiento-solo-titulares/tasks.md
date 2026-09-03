# SPEC-416 · Tasks

## Estado: CERRADO — PR pendiente de abrir

- [x] Worktree `.worktrees/pi-SPEC-416` desde `origin/main 9e63fb1d1`.
- [x] `middleware.ts:194` — filtrar paso 4 por rol titular (PARENT || SCHOOL_ADMIN).
- [x] `sesion-estado-emitter.ts` — defensa en profundidad: forzar `false` para no titulares.
- [x] `middleware.test.ts` — candados bi-direccionales (2 titulares + 6 exentos + 1 API).
- [x] `sesion-estado-emitter.test.ts` — 8 casos (2 emiten true, 6 forzados a false).
- [x] `spec.md`, `plan.md`, `tasks.md` + fila en `specs/README.md`.
- [x] `test:unit` VERDE (2192/2192).
- [x] `tsc` + `arch:check` + `tokens:check` VERDES.
- [ ] Commit + push + PR.
- [ ] Post-deploy · Calidad: verificar los 4 casos (VERIFICADOR opera, PROFESIONAL opera, PARENT sin consentimiento sigue bloqueado, `audit_consentimientos` sin firmas de internos).
