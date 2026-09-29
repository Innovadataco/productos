# Plan · SPEC-774 · la suite de CI corre sobre `main`

## Compuerta §4 — este plan PARA acá
`spec.md` + `plan.md` son el DISEÑO. El CEO aprueba (D-1..D-4) antes de `tasks.md` + implementación.
**NADA de `ci.yml` hasta que entre el PR de Calidad (#775).** Coordinación explícita: su PR primero.

## Coordinación sobre `ci.yml` (crítica)
Tres specs tocan `ci.yml`: **#767** (ya en `main`, gate duro de historial), **#775** (Calidad, job e2e — EN VUELO ahora), **774** (esta). Van en SERIE. **774 se implementa DESPUÉS de que #775 mergee**, y se rebasa sobre ese `main` para editar el `ci.yml` que ya trae el job de Calidad. Editar el archivo en paralelo con Calidad pierde uno de los dos cambios.

## Blast radius (medido)

| Archivo | Qué cambia | Cuándo |
|---|---|---|
| `.github/workflows/ci.yml` L12 | `push.branches: [feature/001-scaffolding]` → `[main]` | tras #775 |
| `.github/workflows/ci.yml` L378 | `if: …'refs/heads/feature/001-scaffolding'` → `…'refs/heads/main'` (paso duraciones, D-2) | tras #775 |
| `.github/workflows/ci.yml` L30, L376 | comentarios que nombran la rama obsoleta → `main` | tras #775 |
| `scripts/…/ci-trigger.candado.test.ts` (nuevo) | meta-aserción: lee el `ci.yml` REAL, `push.branches ⊇ {main}` | ahora (nace rojo) |
| `vitest.unit.includes.ts` | registra el candado en la lane unit | ahora |

- **`ci.yml` NO se toca en este PR de §4.** El candado sí se puede escribir ya: nace **rojo** (el `ci.yml` de hoy no tiene `main`) — es el born-red esperado, se confirma por exit code, y pasa a verde cuando FR-1 entre (tras #775). Igual que 767: born-red → arreglo → verde → duro.
- **Texto histórico (423 specs + 15 docs) y otros productos (4 conv. + 459): NO se tocan.**

## La meta-aserción (candado) — contrato

- **Lee el `ci.yml` real**, no una constante. Ruta: el `ci.yml` vive en la RAÍZ del repo (monorepo); desde el dir del producto (`cwd` del test) es `../.github/workflows/ci.yml`. El candado resuelve esa ruta y falla claro si no existe (no pasa en vacío).
- **Sin dep de YAML** en el repo → parseo DIRIGIDO del bloque `on: push: branches:`: localizar `push:` bajo `on:`, leer su `branches:` (forma `[a, b]` o lista `- a`), y afirmar que incluye `main`. Robusto a formato de lista; no un regex ciego sobre todo el archivo (que matchearía `pull_request` u otros `branches:`).
- **Control positivo por MUTACIÓN:** el test se ejercita contra un `ci.yml` de prueba (fixture en memoria) con y sin `main`: con `main` → pasa; sin `main` (solo rama obsoleta) → **rojo**. Así el candado se prueba sin depender del estado del archivo real. Y una aserción contra el archivo REAL para que el defecto vivo lo dispare.
- **D-4:** FR-3 (push.branches ⊇ {main}) es la aserción DURA. La de L378 (paso de duraciones sobre `main`) va como aserción SEGUNDA/blanda, sin acoplar a un nº de línea (buscar el `if` del paso de duraciones y verificar que su ref sea `main`).

## Números para D-1 (ya medidos)
- Suite completa: **17.5 min wall** (`36550822604`). Camino crítico: `test-integration` shard ~15.3 min.
- Merges/día a `main`: 8,8,9,9 (24–28) · **38** el 29. → ~9/día típico.
- `concurrency` ya no cancela `main` (cada estado se verifica). Palanca de costo en ráfaga: `cancel-in-progress:true` para `main` (pierde atribución).

## Gate de calidad (al implementar, tras #775)
`tsc` + `lint` + `test:unit` COMPLETO (specs-discipline) + el candado corriendo + `build` compila. Verificar por exit code. Confirmar el candado born-red HOY (contra el `ci.yml` sin `main`) y verde tras el fix. PR + REALIZADO.

## Secuencia
§4 (este doc) → **PARÁ, aprobación CEO (D-1..D-4)** → escribir el candado (nace rojo) + registrarlo → **esperar #775 en `main`** → rebase → editar `ci.yml` (L12/L378/comentarios) → candado verde → gate → PR.
