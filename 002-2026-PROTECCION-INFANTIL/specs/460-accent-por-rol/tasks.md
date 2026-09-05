# SPEC-460 · Tasks

## Hecho (este PR)

- [x] Worktree apilado sobre `work/pi-SPEC-454-button-sistema-diseno` (necesita el Button que lee `--accent`).
- [x] `:root`: `--accent-rgb` (default pino) + `--accent` derivado.
- [x] `--accent-rgb` en theme-colegio (pino) y theme-padre (cielo).
- [x] Nuevos theme-admin (ámbar-ink) y theme-profesional (cielo) con el patrón completo.
- [x] Familia Tailwind `accent` → `--accent-rgb` (suelta el pino fijo).
- [x] Layouts admin y profesional aplican su tema.
- [x] Candado `accent-por-rol.candado.test.ts` (8 tests), verificado por mutación.
- [x] Preflight: tsc + eslint + tokens:check (1021) + arch:check + suite unit (303 archivos, 2593 tests).

## Pendiente

- [ ] Commit + push + PR (apilado sobre 454) + reportar al CEO.
- [ ] Rebasar sobre main cuando 454 mergee; reapuntar base del PR a main.
- [ ] Certificación de Diseño (cada territorio con su acento).
