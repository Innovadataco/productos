# SPEC-466 · Tasks

## Hecho (este PR)
- [x] `tokens-check.ts`: guard `<=` documentado + mensaje que prohíbe tocar el PISO al bajar.
- [x] Modo `--tension`: re-mide y aprieta el PISO al mínimo real; idempotente; nunca sube.
- [x] Candado `tokens-ratchet-sin-serializar.candado.test.ts` (4 tests): merge real estilo 432 + contraprueba + guard real (verde/rojo). Verificado ejecutando el script.
- [x] Preflight: tsc + tokens:check + arch:check + generar-readme --check + suite unit.

## Pendiente
- [ ] Commit + push + PR + reportar al CEO.
- [ ] (Infra) job periódico que corra `--tension` sobre main fresco.
