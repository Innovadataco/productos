# SPEC-476 · Tasks

## Hecho (este PR)

- [x] Rama desde `origin/main 3cedab90b`; verificado que la fuente de los 12 está quieta en main.
- [x] 12 muebles traídos (componente + candado + spec): 457/458/461/464/467/469/470/471/472/473/474/475.
- [x] `globals.css` de Alerta por patch (único archivo que main movió); `tokens-check.ts` intacto (piso 1021).
- [x] `vitest.unit.includes.ts` = main + 11 candados (Alerta por glob); `specs/README.md` regenerado una vez.
- [x] Candado de SPEC-466 fortalecido (robusto a holgura) + verificado por mutación.
- [x] Neutralizadas las menciones «piso X→Y» en las 6 specs cadena-piso; Status de 458 → IMPLEMENTADO.
- [x] Preflight: lint 0 · tsc 0 · arch VERDE · tokens ~967 ≤ 1021 · readme al día · unit completa.

## Pendiente

- [ ] Commit + push + PR; cerrar los 12 PRs viejos apuntando al lote; reportar al CEO.
- [ ] Rebase trivial si main se mueve antes del merge (solo generados).
- [ ] **Certificación de Diseño por mueble** (post-merge) — hasta su ✅ no cierra en el inventario.
