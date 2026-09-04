# SPEC-423 · Tasks

## Estado: CERRADO — PR pendiente de abrir

- [x] Worktree `.worktrees/pi-SPEC-423` desde `origin/main f57eb7033`.
- [x] Padres · reescribir `restablecer-password` (solo genera + password siempre) + NUEVO `reenviar-email`.
- [x] Profesionales · reescribir `restablecer-password` + NUEVO `reenviar-email` (`enviarBienvenidaProfesional`).
- [x] Operadores · fix `reenviar-email` (password siempre + encolado + mensaje honesto).
- [x] Colegios · fix `reenviar-email` (mismo tratamiento).
- [x] Solicitudes · fix `profesionales/solicitudes/reenviar` (enlace siempre).
- [x] Client `ProfesionalesGestionClient.tsx` — botón "Reenviar por correo" adicional.
- [x] Client `PadresPageClient.tsx` — función y botón "Reenviar por correo" adicional.
- [x] Candado `credencial-siempre-visible.candado.test.ts` + entrada en vitest.unit.includes.
- [x] Regenerar `docs/architecture/02-roles-capacidades.md`.
- [x] `spec.md`, `plan.md`, `tasks.md` + fila en `specs/README.md`.
- [x] `test:unit` 2319/2319 · `tsc` · `arch:check` (7 gates) · `tokens:check` (piso 1079) · `eslint` verdes.
- [x] Regresión: `sed` de un endpoint reintroduce el bug → candado ROJO listando la fuga.
- [ ] Commit + push + PR.
- [ ] Post-deploy: CEO reactiva `auth.registro_enlace_profesional` y `auth.bienvenida_profesional`.
