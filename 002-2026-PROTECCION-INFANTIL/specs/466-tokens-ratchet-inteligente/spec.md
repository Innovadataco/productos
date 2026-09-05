# SPEC-466 · El piso de `tokens:check` deja de serializar los merges

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: medido en vivo la noche del 04-09 — 4 muebles del rediseño (Button/Badge/Alerta/Cargando) listos a la vez, todos bajando el mismo piso y chocando en esa línea. Clase de conflicto de SPEC-432, pero sobre un NÚMERO (union no sirve).

## El problema

`tokens:check` comparaba el conteo de color crudo contra un piso hardcodeado, y por disciplina cada PR que bajaba crudos **reescribía ese número**. Dos PRs paralelos chocaban en la línea `const PISO = N` de `scripts/tokens-check.ts` aunque tocaran componentes distintos. Con 4 muebles a la vez = 4 rebases secuenciales + 4 CI completos.

## El arreglo

1. **El guard es `<=`, explícito**: falla solo si el conteo **SUBE** (`total > PISO`). Un PR que baja crudos **no toca la constante PISO** — pasa mientras no suba. Varios muebles mergean sin colisionar en esa línea. (El guard ya era `total > PISO`; esta spec lo documenta como contrato y reescribe el mensaje para prohibir explícitamente tocar el PISO al bajar.)
2. **La tensión del ratchet se hace por barrido, no por PR**: `npx tsx scripts/tokens-check.ts --tension` re-mide sobre el árbol actual y, si el conteo real es menor, reescribe el PISO al mínimo. Lo corre un barrido periódico / PR-bot sobre `origin/main` fresco — no cada PR. Baja, nunca sube; idempotente cuando ya está apretado.
3. Un PR **puede** apretar el piso si quiere (opcional), pero no está **obligado**.

## Candados — `scripts/tokens-ratchet-sin-serializar.candado.test.ts` (4 tests)

- **Merge real (estilo SPEC-432)**: dos ramas que bajan crudos en archivos distintos, sin tocar `tokens-check.ts`, mergean sin conflicto; la línea del PISO queda intacta.
- **Contraprueba de merge**: si cada rama reescribe el PISO (modelo `==` viejo), el merge **choca** — prueba que el desatasco viene de NO tocar la línea.
- **Guard real (conducta)**: verde en el estado actual; **rojo** si un crudo nuevo sube el conteo (regresión). Ejecuta el script de verdad.

## Impacto en arquitectura:

- Saca el piso de `tokens:check` de la cadena de serialización de merges. Los muebles del rediseño (Badge/Cargando/Alerta/Input de Dev 02) mergean en paralelo sin rebasar en serie.
- La meta no se afloja: el piso sigue bajando hacia ~0 vía el barrido `--tension`; solo deja de ser terreno de conflicto por-PR.

## Lo que NO cambia

- No se afloja la meta (cerca de 0): el piso sigue bajando, solo que sin serializar.
- El guard sigue fallando si el conteo sube.

## Referencias

- **SPEC-432** (los generados dejan de ser terreno de conflicto) — mismo patrón de candado de merge real, aquí sobre un número.
- **SPEC-157** (ratchet anti color crudo) — el guard original.
- Worktree `.worktrees/pi-SPEC-466` desde `origin/main 7f5534f3c`.
