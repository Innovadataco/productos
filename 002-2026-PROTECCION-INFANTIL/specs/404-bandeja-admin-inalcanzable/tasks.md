# SPEC-404 · Tasks

## Estado: CERRADO — PR abierto

- [x] Worktree fresco `.worktrees/pi-SPEC-404` desde `origin/main d832ec3db` + `npm install`.
- [x] Análisis de fuente (nav-items, page.tsx raíz, 5 callsites de "volver", arch:check).
- [x] `src/app/dashboard/admin/bandeja/page.tsx` nueva URL propia.
- [x] `src/app/dashboard/admin/page.tsx` reescrito como aterrizaje (inicio → bandeja → primer módulo → SinModulosAsignados).
- [x] `nav-items.ts` — bandeja apunta a `/dashboard/admin/bandeja`.
- [x] 5 callsites de "volver" → `/dashboard/admin/bandeja`.
- [x] Aserción `arch:check (d-bis)` — nuevo script + wire-up en `arch-check.ts` + caso en `aserciones.test.ts`.
- [x] Regenerar 5 artefactos de `docs/architecture/*.md`.
- [x] Actualizar `AdminNav.test.tsx`, `NavHeader.test.tsx`, `nav-logo.test.ts`.
- [x] `spec.md`, `plan.md`, `tasks.md`, fila en `specs/README.md`.
- [x] `arch:check` VERDE completo (a/b/c/d/d-bis/e/f).
- [x] `test:unit` VERDE (2111/2111).
- [x] `tsc` + `eslint` VERDES.
- [x] Regresión demostrada: la aserción `(d-bis)` marca ROJO con `nav-items.ts` sin el fix (`git stash`).
- [ ] Commit + push + PR.
- [ ] Rebase al mergear SPEC-405 + quitar `test.fail` del spec e2e de Calidad.
- [ ] Post-deploy: Jelkin verifica que "Bandeja de reportes" abre la bandeja de verdad, con y sin Inicio.
