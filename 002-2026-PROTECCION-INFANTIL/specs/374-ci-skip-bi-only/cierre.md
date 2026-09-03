# SPEC-374 · Cierre — CI de PI salta cuando el PR no lo toca

**Fecha**: 2026-09-02 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-374-ci-skip-bi-only`

## Qué cambió

Un módulo con lógica pura y su test hermano; el workflow lo invoca.

- `scripts/ci/should-skip-pi.mjs` — dos funciones puras (`afectaAPI(path)`,
  `deberSaltar(files)`) y un CLI que lee stdin y escribe `true`/`false`. Es
  quien decide.
- `scripts/ci/should-skip-pi.test.mjs` — **17 tests** que cubren los 9 casos
  del radicado más los bordes (`bi.yml` aislado, lista vacía, PR mixto BI+PI,
  prefijo similar `002-…-DEMO/`).
- `.github/workflows/ci.yml` job `should-skip` — el bash inline
  (`grep -vE ...`) fue reemplazado por
  `printf "%s" "$files_changed" | node ...should-skip-pi.mjs`. Ubuntu-latest
  trae node preinstalado; no hace falta `setup-node` en ese step.

## Por qué NO se usó `on: paths:`

Candado I-249: los checks de PI son requeridos por branch protection. Un
`paths-ignore` que no dispara el workflow deja los checks en estado *pendiente*
para siempre, y ningún PR de otro producto podría mergear. El patrón correcto
es el que ya existe: el workflow igual arranca, `should-skip` decide, y
`skipped` cuenta como éxito.

## Regla de decisión (queda fijada por tests)

La suite corre si algún archivo cambiado…

- **vive bajo `002-2026-PROTECCION-INFANTIL/`** y no es doc-only (excluidos
  `docs/`, `specs/`, cualquier `*.md`), o
- **es uno de los dos workflows compartidos del monorepo**: `ci.yml`,
  `verificar-base-pr.yml`.

En todo lo demás la suite se salta: PRs de `006-BI-…`, `007-PIWEB`, `003-SICOV`,
`004-SARLAFT`, docs raíz (`AGENTS.md`, `README.md`, `.gitignore`), workflows de
otros productos (`bi.yml`, `bi-006.yml`).

## Verificación

- **Local (evidencia)**: los 6 casos clave del radicado corridos por CLI dan lo
  mismo que los tests unitarios — misma lógica, dos vías distintas de
  invocación.
- **Post-merge (obligatoria)**: el PR de `007-2026-PIWEB` de idc-67 sirve de
  testigo del antes/después. Antes: la suite de PI corría 25-30 min sin razón.
  Después: los checks de PI deben salir `skipped` y el PR mergeable rápido.
  Anotado en tasks T008.

## Gate

Tests unitarios del script: **17/17**. `tsc` limpio.

## Evidencia del "antes" (para el candado "verde ≠ funciona")

Estado del PR **#263** de idc-67 (`work/piweb-SPEC-376-sitio-estatico` — solo
toca `007-2026-PIWEB/`, cero cambios en `002-`) minutos antes de este merge:

```
verificaciones               pending
test-unit                    pending
test-integration (1..4)      pending   ← los 4 shards de 25-30 min
journeys                     pending
build                        pending
Ratchets grep-based          pending
TypeScript                   pending
Unit tests                   pending
```

Justo el patrón que describe el radicado — un PR ajeno esperando la suite
completa de PI. Con este cambio en main, el próximo push a #263 debe pasar el
`should-skip` y estas 9 líneas deben salir `skipped`, con el PR mergeable
inmediatamente. Anotado en `tasks.md` T008 como verificación obligatoria.
