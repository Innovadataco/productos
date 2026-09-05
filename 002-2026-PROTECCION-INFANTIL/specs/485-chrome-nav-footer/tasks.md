# SPEC-485 · Tasks

## Hecho (este PR)
- [x] Inventario + triaje en fuente de NavHeader (43) + LandingFooter (2) (candado 15 v5).
- [x] slate/gray→neutros, sky→cielo, emerald→pino, amber→ambar/text-estado-ambar. Pares light/dark → theme-aware; hovers glass → velo (bg-tinta/5).
- [x] Logout (L330/L412) → NEUTRO (.text-muted + hover velo), no rubi (ruling §7.1). Cero rojo en el chrome.
- [x] Color de rol OPERADOR (violet) dejado y flagueado al CEO (sin token).
- [x] Candado `chrome-nav-footer.candado.test.ts` (0 crudo 7 familias incl. red). Muere por mutación.
- [x] Registrar candado en `vitest.unit.includes.ts`.
- [x] Alta palanca: NavHeader/LandingFooter/nav-logo tests (23) verdes (todos los roles).
- [x] Preflight: tsc + eslint + tokens:check + arch:check + generar-readme --check + suite unit.

## Pendiente
- [ ] Commit + push + PR + reportar al CEO (incl. el flag de violet). Al verde, el CEO mergea por run-id.

## Fuera de alcance
- Color de rol OPERADOR (`violet`) → ruling de Diseño.
