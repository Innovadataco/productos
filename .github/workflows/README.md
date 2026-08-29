# Workflows de CI — patrón sentinel multi-producto

Este directorio contiene los workflows de GitHub Actions del monorepo `Innovadataco/productos`. Un workflow por producto (`ci.yml` para PI, `bi.yml` para BI, futuros `ci-000.yml`, `ci-001.yml`, `ci-003.yml`) más el candado transversal `verificar-base-pr.yml`.

## El problema que resuelve este patrón

El ruleset "Gate CI - main" (branch protection en la UI de GitHub, admin: Jelkin) exige N required checks para mergear a `main`. Cuando un producto declara sus checks (ej. `verificaciones`, `test-integration`, `build` de PI) como required, un PR que solo toca otro producto (ej. BI) NO dispara el workflow de PI → esos checks quedan **"expected but not seen"** y GitHub trata al PR como bloqueado indefinidamente.

**Regla dura**: cada producto expone **un solo check agregado** — un job llamado `<slug>-gate` (`pi-gate`, `bi-gate`, …) que corre al final del workflow, evalúa el estado de todos los jobs previos y emite un veredicto único. Ese es el único check que se registra como required en el ruleset. Un sentinel por producto, un required por producto.

## Requisitos por workflow

Cada `<producto>.yml` DEBE cumplir tres cosas:

1. **Los `paths` de `push` y `pull_request` incluyen `.github/workflows/**`** además de la carpeta propia del producto. Sin esto, un cambio a los workflows no dispara los sentinels y el primer PR de infra queda con checks pendientes.
2. **Un job `<slug>-gate` al FINAL del workflow**, con:
   - `if: always()` — corre aunque otros jobs hayan sido skipped/failed/cancelled.
   - `needs:` a **TODOS** los demás jobs relevantes del mismo workflow (los que reflejen la salud del build). Excluye jobs de reporte/observabilidad (ej. `resumen`) y agregadores viejos que estén siendo reemplazados por el propio sentinel.
   - Un step único de shell que use `contains(needs.*.result, 'failure')` y `contains(needs.*.result, 'cancelled')` para decidir el veredicto.
3. **El nombre del job = nombre exacto del check** que Jelkin registrará en el ruleset. Sin `name:` explícito a nivel de job (GitHub usa el id del job por defecto).

## Plantilla YAML — copiar y pegar

Reemplazá `<slug>` (ej. `pi`, `bi`, `mod`, `idc`, `sicov`, `sarlaft`) y `<todos los jobs del workflow>`:

```yaml
  # Sentinel multi-producto (SPEC-299 / BRIEF A-49). Ver .github/workflows/README.md.
  <slug>-gate:
    runs-on: ubuntu-latest
    needs: [<todos los jobs del workflow, separados por coma>]
    if: always()
    # Override defensivo: si el workflow declara `defaults.run.working-directory`
    # a nivel workflow (ej. la carpeta del producto), el sentinel lo hereda pero
    # NO hace `actions/checkout`, así que ese cwd no existe y bash falla al iniciar.
    # Con `working-directory: .` corre siempre en la raíz del checkout (o donde
    # GitHub deje al runner) — inofensivo cuando no hay defaults a nivel workflow.
    defaults:
      run:
        working-directory: .
    steps:
      - name: Evaluar veredicto agregado
        run: |
          set -euo pipefail
          if [[ "${{ contains(needs.*.result, 'failure') }}" == "true" ]]; then
            echo "❌ <slug>-gate: al menos un job requerido falló."
            exit 1
          fi
          if [[ "${{ contains(needs.*.result, 'cancelled') }}" == "true" ]]; then
            echo "❌ <slug>-gate: al menos un job requerido fue cancelado."
            exit 1
          fi
          echo "✅ <slug>-gate: todos los jobs requeridos pasaron o fueron skipped."
```

Y en `on:`:

```yaml
on:
  push:
    paths:
      - "<carpeta-del-producto>/**"
      - ".github/workflows/**"
  pull_request:
    paths:
      - "<carpeta-del-producto>/**"
      - ".github/workflows/**"
```

## Cómo registrar el check en el ruleset

Cuando el producto merge por primera vez el sentinel a `main`:

1. Confirmar en `gh pr checks <PR-de-arranque>` que el `<slug>-gate` aparece con `conclusion=success`.
2. Pedir a Jelkin (mensaje directo o issue) que agregue `<slug>-gate` como required check al ruleset **"Gate CI - main"** en Settings → Rules → Rulesets.
3. Sugerir a Jelkin que retire del ruleset cualquier check individual del producto que el sentinel ya cubre (ej. una vez que `pi-gate` está registrado, `verificaciones` o `test-integration` como required se vuelven redundantes).

## Convención de nombres

| Producto                        | Carpeta                              | Workflow      | Nombre del sentinel |
|---------------------------------|--------------------------------------|---------------|---------------------|
| 000 · MODELOS                   | `000-2026-MODELOS/`                  | `ci-000.yml` (por crear) | `mod-gate`   |
| 001 · INNOVADATACO              | `001-2026-INNOVADATACO/`             | `ci-001.yml` (por crear) | `idc-gate`   |
| 002 · PROTECCIÓN INFANTIL       | `002-2026-PROTECCION-INFANTIL/`      | `ci.yml`      | `pi-gate`           |
| 003 · SICOV-OTPC                | `003-2026-SICOV-OTPC/`               | `ci-003.yml` (por crear) | `sicov-gate` |
| 005 · BI                        | `005-2026-BI-INTELIGENCIA-NEGOCIO/`  | `bi.yml`      | `bi-gate`           |
| SARLAFT (futuro)                | por definir                          | `ci-sarlaft.yml` (por crear) | `sarlaft-gate` |

## Traza

- SPEC-299 · `002-2026-PROTECCION-INFANTIL/specs/299-sentinels-ci-multi-producto/`
- BRIEF A-49 · gestión-de-proyectos
- INSTRUCTIVO 002-PI-202
