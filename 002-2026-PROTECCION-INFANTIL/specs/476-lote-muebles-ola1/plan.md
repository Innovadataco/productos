# SPEC-476 · Plan

## Método

Lote de entrega, no de rediseño: junta 12 muebles ya construidos sobre `origin/main` fresco para colapsar 12 merges en uno. Cada mueble conserva su spec y su candado; el lote solo toca los generados una vez y suma el arreglo del candado de SPEC-466.

## Orden

1. Rama `work/pi-SPEC-476-lote-muebles-ola1` desde `origin/main 3cedab90b` (base final, post-accent).
2. Traer de cada rama: componente(s) + candado + carpeta `specs/<n>/`. Verificado antes: la fuente de los 12 está quieta en main → checkout directo; `globals.css` de Alerta por patch (main se movió).
3. NO tocar `scripts/tokens-check.ts` (regla SPEC-466). Regenerar `specs/README.md` una vez; `vitest.unit.includes.ts` = main + 11 líneas de candado (Alerta va por su glob).
4. Fortalecer el candado de SPEC-466 para tolerar la holgura que su diseño exige (mide estado, siembra hasta superar el piso). Verificar por mutación.
5. Neutralizar en las 6 specs cadena-piso las menciones «piso X→Y» (históricas de cuando iban sueltas).
6. Preflight completo + suite unit. Commit, push, PR, cerrar los 12 PRs viejos apuntando al lote.

## Fuera de alcance

- Cambiar conducta/API de cualquier mueble (esto es entrega, no rediseño).
- Apretar el piso (lo hace `--tension`, no este PR).
- #383 colegio (territorio; va aparte, mismo criterio floor-safe).
