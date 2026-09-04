# SPEC-416 · Plan

## Alcance
Fix quirúrgico + defensa en profundidad. Dos archivos productivos, dos test files, spec docs. Sin migraciones ni cambios de contrato REST.

## Pasos
1. Worktree fresco `.worktrees/pi-SPEC-416` desde `origin/main 9e63fb1d1` + `npm install`.
2. `middleware.ts:194` — condicionar el paso 4 a `sesion.rol === "PARENT" || sesion.rol === "SCHOOL_ADMIN"` con comentario que cita al CEO y al motivo probatorio.
3. `sesion-estado-emitter.ts` — forzar `requiereConsentimiento = false` para todo rol que no sea titular (defensa en profundidad).
4. `middleware.test.ts` — 4 casos candado: 2 titulares siguen bloqueados + 6 parametrizados exentos + 1 API VERIFICADOR sin 403.
5. `sesion-estado-emitter.test.ts` — 2 titulares emiten true + 6 exentos forzados a false.
6. `spec.md`, `plan.md`, `tasks.md`, fila en `specs/README.md`.
7. Verificar: `test:unit` completo, `tsc`, `arch:check`, `tokens:check`.
8. Commit + push + PR.

## Verificación
- 2192/2192 unit tests (149 en pool routing con los 9 nuevos).
- `arch:check` VERDE (7 gates).
- `tokens:check` VERDE (piso 1079).
- Post-deploy: Verificador puede operar; PARENT sin consentimiento sigue bloqueado; `audit_consentimientos` no muestra firmas de internos.

## Fuera de scope
- Purga histórica de `audit_consentimientos` (evaluación aparte post-deploy).
- Cambiar la semántica de `requiereConsentimientoActual` (usada en otros contextos legítimos).
