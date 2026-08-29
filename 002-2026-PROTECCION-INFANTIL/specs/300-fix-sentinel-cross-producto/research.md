# Research — SPEC-300 · Fix sentinel CI cross-producto

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

## Decisión principal — Opción A vs Opción B

### Decision

**Se implementa Opción A**: eliminar el filtro `paths:` de `on:.push` y `on:.pull_request` en `ci.yml` **y** en `bi.yml`, y replicar en `bi.yml` el patrón `should-skip` que ya existe en `ci.yml`. Los gates `pi-gate` y `bi-gate` conservan sus names literales y sus `if: always()`.

### Rationale

Cinco factores empujan a A por encima de B:

1. **Patrón ya probado en producción.** El job `should-skip` de PI (`ci.yml:26-37`) lleva desde SPEC-107/002-PI-063 funcionando: detecta doc-only y reporta `skip=true` con `skipped` en los needs → `pi-gate` (con `if: always()` y `contains(needs.*.result, 'failure') == false`) reporta verde trivial. Ese comportamiento cubre exactamente el requisito del ruleset ("check aparece siempre, verde cuando no aplica"). Duplicarlo en `bi.yml` es un copy-paste con adaptación del grep (paths PI → paths BI).
2. **Diff mínimo.** Contando aproximadamente 20 líneas: 3 líneas en `ci.yml` (borrar bloque `paths:` de `push` y `pull_request`), y 3 líneas menos en `bi.yml` (borrar `paths:` de `on:`), 12 líneas del nuevo job `should-skip` en `bi.yml`, y 4 líneas de `needs`/`if` distribuidas entre los 4 jobs pesados + `bi-gate`. Cero código nuevo fuera de esos YAML.
3. **Cero superficie nueva de fallo.** No introducimos polling `gh api`, ni permisos nuevos del `GITHUB_TOKEN`, ni dependencias entre workflows. `should-skip` corre con `actions/checkout@v4` y bash puro, exactamente como en PI.
4. **Costo GH Actions marginal.** Cada PR dispara ambos workflows en vez de uno. Costo extra: `should-skip` + `bi-gate` (o `pi-gate` cuando salte todo) ≈ 15–30 segundos de runner por workflow que antes no arrancaba. En volumen de repo (< 50 PRs/día) esto suma < 30 minutos runner/día → **irrelevante bajo el plan actual**.
5. **Reversibilidad.** Si Opción A muestra un edge case en producción (p. ej. `should-skip` de BI clasifica mal un caso raro), el rollback es reintroducir `paths:` en `on:` (una línea). Opción B, por el contrario, deja un archivo `gates.yml` nuevo con lógica de polling que hay que desmontar.

### Alternatives considered

**Opción B — nuevo `.github/workflows/gates.yml` sin paths con polling `gh api`.**

Descartada por costo desproporcionado al beneficio:

- **Complejidad de polling.** El gate ortogonal necesita saber si el workflow del producto arrancó, si terminó, y con qué resultado. Requiere loop `gh api /repos/:owner/:repo/actions/runs?head_sha=$GITHUB_SHA` con backoff, timeouts, y manejo de "workflow todavía no arrancó" vs "workflow terminó fallando". Esto son 40–60 líneas de bash frágil con casos límite reales (workflow que arranca 3 s tarde, workflow cancelado por push nuevo, workflow que expira por concurrency group).
- **Permisos del `GITHUB_TOKEN`.** Para hacer `gh api` cross-workflow se necesita `actions: read` explícito. Aunque es fácil de añadir, es superficie nueva de permisos que Opción A no requiere.
- **Race condition intrínseca.** Si `gates.yml` arranca antes que `ci.yml`/`bi.yml` (el orden no está garantizado en GitHub Actions), el poller ve el sha sin runs y hay que esperar. Si arranca después, ve runs `in_progress`. Ambos casos son manejables pero cada uno es un timeout y un caso de test.
- **Duplicación de veredicto.** Opción A tiene el veredicto en un solo lugar (el `pi-gate`/`bi-gate` del workflow del producto). Opción B lo replica en `gates.yml` reflejando el resultado de otro workflow — dos puntos de verdad para el mismo hecho. Si divergen (por retries o por bug), el ruleset se contradice a sí mismo.
- **Ganancia estética marginal.** El único beneficio real es "separación limpia de responsabilidades". Para 3 sentinels que reportan un veredicto agregado, esa ganancia no compensa la complejidad.

**Opción C — Poner los sentinels como `workflow_run` de otro workflow.**

Descartada de antemano: los eventos `workflow_run` no aparecen como checks del PR (solo aparecen como runs "downstream" en la UI). El ruleset nunca los vería.

## Puntos técnicos verificados en fuente

### Verificación 1: `should-skip` de PI es el patrón correcto

Leído en `.github/workflows/ci.yml:26-37`:

```yaml
should-skip:
  runs-on: ubuntu-latest
  outputs:
    skip: ${{ steps.detect.outputs.skip }}
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 2 }
    - id: detect
      run: |
        files_changed=$(git diff --name-only HEAD^ HEAD || true)
        code_files=$(echo "$files_changed" | grep -vE '(^002-2026-PROTECCION-INFANTIL/(docs|specs)/|^docs/|^specs/|\.md$)' || true)
        if [ -z "$code_files" ]; then echo "skip=true" >> "$GITHUB_OUTPUT"; else echo "skip=false" >> "$GITHUB_OUTPUT"; fi
```

Adaptación para BI:

```yaml
should-skip:
  runs-on: ubuntu-latest
  outputs:
    skip: ${{ steps.detect.outputs.skip }}
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 2 }
    - id: detect
      run: |
        files_changed=$(git diff --name-only HEAD^ HEAD || true)
        code_files=$(echo "$files_changed" | grep -vE '(^005-2026-BI-INTELIGENCIA-NEGOCIO/(docs|specs)/|^docs/|^specs/|\.md$)' || true)
        if [ -z "$code_files" ]; then echo "skip=true" >> "$GITHUB_OUTPUT"; else echo "skip=false" >> "$GITHUB_OUTPUT"; fi
```

Diferencia única: `002-2026-PROTECCION-INFANTIL` → `005-2026-BI-INTELIGENCIA-NEGOCIO` en el regex de exclusión. El resto es idéntico.

### Verificación 2: `bi-gate` ya tiene `if: always()` y evalúa `contains(needs.*.result, 'failure')`

Leído en `.github/workflows/bi.yml`:

```yaml
bi-gate:
  runs-on: ubuntu-latest
  needs: [verify, typecheck, test-unit, build]
  if: always()
  defaults:
    run:
      working-directory: .
  steps:
    - name: Evaluar veredicto agregado
      run: |
        set -euo pipefail
        if [[ "${{ contains(needs.*.result, 'failure') }}" == "true" ]]; then
          echo "❌ bi-gate: al menos un job requerido falló."
          exit 1
        fi
        ...
```

Cambio necesario: agregar `should-skip` a `needs:`. `contains(needs.*.result, 'failure')` es `false` si todo está `skipped`, por lo que el veredicto queda verde trivial cuando `should-skip=true`. Comportamiento heredado ya validado en `pi-gate`.

### Verificación 3: `defaults.run.working-directory` en `bi.yml` es problemático

`bi.yml` declara a nivel workflow `defaults.run.working-directory: 005-2026-BI-INTELIGENCIA-NEGOCIO`. El nuevo job `should-skip` hace `git diff` sobre la raíz del repo, no sobre la carpeta del producto. Debe **override** su working-directory:

```yaml
should-skip:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: .
  outputs: ...
```

`bi-gate` ya lo hace por el mismo motivo (bi.yml:88-90). Aplicamos el mismo override en `should-skip`.

### Verificación 4: el `pi-gate` existente cubre `should-skip`

Leído en `ci.yml`:

```yaml
pi-gate:
  runs-on: ubuntu-latest
  needs: [should-skip, verificaciones, test-unit, test-integration, test-integration-coverage, journeys, build]
  if: always()
```

Ya tiene `should-skip` en `needs:`. Confirma que el patrón está desplegado tal cual se propone para BI.

### Verificación 5: `verify` de BI ya es la primera dependencia

`bi.yml` — `typecheck` `needs: verify`, `test-unit` `needs: verify`, `build` (por inferir; lo verificamos en el archivo real durante `/speckit-implement`). Añadir `should-skip` al `needs:` de `verify` y propagar via `if: needs.should-skip.outputs.skip != 'true'` desde `verify` (que corre primero) cascadea a los demás sin necesidad de agregar `if:` en cada job. Alternativa: agregar `if:` en cada job pesado explícitamente, lo cual es más verboso pero elimina la dependencia implícita entre saltar `verify` y saltar `typecheck`. **Elegimos la forma explícita** — cada job pesado declara `needs: [should-skip, ...]` + `if: needs.should-skip.outputs.skip != 'true'`. Es más código pero más claro y no depende del orden interno.

## Consideraciones para test acid

### Test acid positivo (US1 + US2 combinados)

Un PR con SOLO cambio en `README.md` de la raíz del repo no toca ni `002-*` ni `005-*`. Ambos `should-skip` reportan `skip=true`. Ambos gates reportan `success` en < 90 s. Ambos aparecen como checks en `gh pr checks`.

### Test acid negativo solo-PI

Un PR con SOLO un cambio menor en `002-2026-PROTECCION-INFANTIL/AGENTS.md` (un espacio extra) toca `002-2026-PROTECCION-INFANTIL/**`. `should-skip` de PI reporta `skip=true` (el filtro `\.md$` lo excluye) — comportamiento actual, se conserva. `pi-gate` verde trivial. `should-skip` de BI reporta `skip=true` (no hay archivos BI). `bi-gate` verde trivial. **Ambos verdes**, aunque el trigger fuese PI-only.

Nota importante: este caso NO ejerce jobs pesados de PI porque el `should-skip` de PI ya salta cambios `.md`. Para ejercer jobs pesados hay que tocar código PI (por ejemplo un espacio extra en `002-2026-PROTECCION-INFANTIL/src/lib/README.md` NO cuenta porque `\.md$` los excluye; se necesita tocar un archivo `.ts`/`.tsx`/`.json` fuera de `docs|specs`). Para el test acid de esta SPEC, el objetivo mínimo es demostrar que **ambos gates aparecen**; el ejercicio de jobs pesados PI ya está cubierto por los CI diarios.

### Test acid negativo solo-BI

Similar al anterior invertido: PR con cambio en `005-2026-BI-INTELIGENCIA-NEGOCIO/README.md`. Ambos gates verdes triviales. Si se toca `005-*/scripts/**`, `verify` de BI ejerce ratchets reales.

### Simulación local

`should-skip` no puede probarse offline con precisión total porque depende del entorno del runner. Sí podemos validar el YAML sintácticamente con `yq` o `python -c 'import yaml, sys; yaml.safe_load(sys.stdin)' <workflow` para descartar typos. Para validar el comportamiento hay que abrir un PR real.

## Deuda técnica creada

- El `should-skip` de BI hereda la limitación pre-existente del de PI: `git diff HEAD^ HEAD` puede reportar mal en PRs con force-push. Documentado en `spec.md` §Edge Cases.
- La lista de patrones del grep está duplicada entre `ci.yml` y `bi.yml`. Refactor futuro: mover a un action reutilizable `.github/actions/should-skip/action.yml`. Fuera de alcance de esta SPEC.

## Referencias

- `.github/workflows/ci.yml` (ratchet actual `should-skip` + `pi-gate`)
- `.github/workflows/bi.yml` (ratchet actual `bi-gate` sin `should-skip`)
- SPEC-299 (002-PI-202): introdujo los sentinels y su convención de names literales
- Instructivo 002-PI-205 §Alcance del fix — DOS OPCIONES
- Reporte cierre Fábrica PI-1 (2026-08-29) §2c: apuntó el bug antes del arranque de este fix
