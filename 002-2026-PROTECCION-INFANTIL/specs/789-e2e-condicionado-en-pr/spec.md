# SPEC-789 · `test-e2e` condicionado en pull_request (drenar la cola de CI)

**Status**: IMPLEMENTADO
**Autor**: Dev 2 (ODIN) · 2026-09-29
**Impacto en arquitectura:** Ninguno en el runtime del producto (`src/`, schema, proxy, nav, stack sin cambios). Solo toca CI: `.github/workflows/ci.yml` y un módulo de decisión en `scripts/ci/`. No altera la línea base de `docs/architecture/`.

## Problema

La cola de CI dejó de drenar: 8 corridas encoladas, 2 corriendo, la más vieja a 46 min; diez PRs abiertos y ninguno llegando a `pi-gate` (el último de la cadena). El costo principal es el job `test-e2e`: ~19 min en CADA PR.

Ese costo no se justifica en un PR porque la señal de `test-e2e` NO informa la decisión de mergear:

- El paso de la suite es `continue-on-error` (ratchet BLANDO, SPEC-775): no puede reportar el fallo de la suite.
- El número OFICIAL de specs rojas sale de `main`, que desde SPEC-774 se verifica en CADA push (merge) — una rotura del arnés se caza minutos después de mergear.
- La ÚNICA señal DURA del job en un PR es la rotura del ARNÉS de siembra (esquema/seed/pgboss), que solo puede ocurrir si el PR toca esos insumos.

## Decisión

En `pull_request`, `test-e2e` corre SI Y SOLO SI el diff puede romper el arnés: toca **esquema**, **siembra** o `tests/e2e/**`. En **push a `main`** (y `workflow_dispatch`) corre **SIEMPRE**, sin condición de archivos: ahí está la señal integrada de la que sale el número.

## Requisitos funcionales

- **FR-001:** El sistema DEBE decidir "¿el diff puede romper el arnés e2e?" por los archivos cambiados, en un módulo con test unitario (`scripts/ci/should-run-e2e-pi.mjs`), mismo patrón que `should-skip-pi.mjs`.
- **FR-002:** En `pull_request`, el job `test-e2e` DEBE saltarse cuando el diff no toca esquema/siembra/`tests/e2e/**`.
- **FR-003:** En push a `main` y `workflow_dispatch`, el job `test-e2e` DEBE correr siempre (sujeto solo al `should-skip` general que ya existía).
- **FR-004:** La condición DEBE implementarse con `if:` a nivel de job (conclusión `skipped` = éxito para required checks), NUNCA con `on: paths:` (candado I-249: dejaría el check REQUERIDO pendiente para siempre y bloquearía merges de otros productos).
- **FR-005:** La razón DEBE quedar escrita AL LADO de la condición, para que nadie la "restaure por completitud".

## Alcance del arnés (qué archivo obliga a correr)

Relativo a `002-2026-PROTECCION-INFANTIL/`:

| Categoría | Prefijo |
|---|---|
| Esquema (+ seed.ts) | `prisma/` |
| Suite | `tests/e2e/`, `playwright.config` |
| Siembra e2e | `scripts/seed-e2e-` |
| Arnés (pgboss) | `scripts/ensure-pgboss` |
| Siembra (insumo) | `.env.test` |

Dirección conservadora: ante la duda, CORRER. Un falso negativo (saltar un PR que sí rompía el arnés) dejaría pudrir la siembra; un falso positivo solo gasta 19 min. `main` es la red de seguridad final (SPEC-774).

## Criterios de éxito

- **SC-001:** Un PR que solo toca `src/` de PI NO dispara `test-e2e` (se ahorran ~19 min y la cola drena).
- **SC-002:** Un PR que toca `prisma/schema.prisma` (o migrations/seed/`tests/e2e/**`) SÍ dispara `test-e2e`.
- **SC-003:** Cada push a `main` corre `test-e2e` (número oficial visible).
- **SC-004:** `test-e2e` nunca queda en estado *pendiente* que bloquee merges (solo `success`/`skipped`).

## Supuestos

- `pull_request` corre sobre el merge-ref; el `files_changed` (`git diff HEAD^ HEAD`) del step `should-skip` es la misma fuente que ya usa la decisión de saltar — se reutiliza, con su misma fidelidad y limitación documentada.
- `test-e2e` NO está en `gate`/`pi-gate`, así que saltarlo en un PR no afecta la compuerta de merge.
