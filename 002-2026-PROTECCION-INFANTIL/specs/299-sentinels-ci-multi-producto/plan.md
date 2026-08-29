# Implementation Plan: Sentinels CI multi-producto

**Branch**: `work/pi-SPEC-299-sentinels-ci-multi-producto` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md) · INSTRUCTIVO 002-PI-202 · BRIEF A-49

## Summary

Cada producto expone un job `<slug>-gate` como último paso de su workflow, con `if: always()` y `needs:` a TODOS los jobs del workflow, que colapsa el estado agregado en un único check por producto. GitHub siempre ve el check aunque el producto no aplique al PR (éxito trivial), aunque el workflow no arranque paths sensibles (éxito trivial via el disparador ampliado a `.github/workflows/**`), y falla el gate cuando algún job real falla o es cancelado. Un `README.md` en `.github/workflows/` documenta el patrón para los próximos productos.

## Technical Context

**Language/Version**: GitHub Actions workflow YAML (schema v2, runner ubuntu-latest). Sin cambios de Node/TypeScript/Prisma.

**Primary Dependencies**: GitHub Actions runtime; expresiones `needs.<job>.result`, `contains()`, `if: always()`. Cero dependencias npm nuevas.

**Storage**: N/A — cambios son puramente de configuración de CI.

**Testing**: Verificación en vivo sobre el propio PR (US-2 del spec). `gh pr checks <PR>` como oracle de veredicto. Sin unit/integration tests nuevos (los jobs existentes de PI ya cubren regresiones de código de producto).

**Target Platform**: GitHub Actions (github.com hosted runners).

**Project Type**: Infra de CI monorepo.

**Performance Goals**: `pi-gate` y `bi-gate` cada uno < 15 s en el peor caso (checkout implícito o none + evaluación de `needs.*.result` en shell); < 5 s en el mejor caso (sin checkout, un solo step de evaluación). No añade latencia significativa al pipeline: corre al final, cuando todo lo demás ya terminó.

**Constraints**:
- NO tocar jobs preexistentes (candado A-49 del brief).
- NO tocar `verificar-base-pr.yml` (candado A-47).
- Nombres exactos: `pi-gate`, `bi-gate` (los usará Jelkin en el ruleset).
- `needs:` completo — si falta un job real, el sentinel puede reportar verde con un job en rojo.

**Scale/Scope**: 2 workflows editados + 1 archivo nuevo. Diff estimado ~120 líneas totales (~40 ci.yml, ~40 bi.yml, ~40 README).

## Constitution Check

*GATE: Must pass before implementation. Re-check after commit before push.*

Constitución de PI (`.specify/memory/constitution.md`): no hay artículos aplicables directamente a cambios de CI/infra (los artículos gobiernan código de producto, DAL, tests, migraciones). Cumple por no aplicar.

Candados operativos verificados:
- **A-47 candado 2**: rama `work/pi-SPEC-299-...` cumple regex `^work/(pi|bi|mod|idc|sicov|sarlaft)-SPEC-[0-9]+-` — OK.
- **A-47 candado 3**: base = `main` — OK.
- **A-49 (brief)**: no tocar jobs preexistentes → sí cumplo (solo ampliación de `paths` + job aditivo al final).
- **5 Reglas de Oro**: (1) Spec Kit ✓ · (2) push a GitHub (fase implement) · (3) verificación en vivo del propio PR sustituye tests unitarios (no aplican a infra CI) · (4) desplegable (el `<slug>-gate` es el propio deploy — cambia comportamiento de CI en el mismo PR) · (5) documentar → README nuevo + spec.md + plan.md + tasks.md.
- **D-52 compuerta §4 clásica**: paro tras spec+plan, espero APRUEBO de Fábrica antes de `/speckit.tasks`.
- **D-54 push único al final**: aplico.

## Project Structure

### Documentation (this feature)

```text
002-2026-PROTECCION-INFANTIL/specs/299-sentinels-ci-multi-producto/
├── spec.md                # ya escrito
├── plan.md                # este archivo
└── tasks.md               # se genera en /speckit.tasks post-APRUEBO
```

No hay `research.md`, `data-model.md`, `contracts/`, `quickstart.md` — la feature es infra CI, no requiere fases de investigación ni modelado de datos.

### Source Code (repository root — monorepo)

```text
.github/workflows/
├── ci.yml                 # MODIFICADO: +paths .github/workflows/** ; +job pi-gate
├── bi.yml                 # MODIFICADO: +paths .github/workflows/** ; +job bi-gate
├── verificar-base-pr.yml  # SIN TOCAR (candado A-47)
└── README.md              # NUEVO: patrón sentinel documentado
```

**Structure Decision**: Los tres archivos viven en la raíz del monorepo bajo `.github/workflows/`, no dentro de la carpeta de un producto. Los workflows por producto son globales al repo (GitHub Actions solo lee `.github/workflows/` en la raíz); el README que documenta el patrón multi-producto también es global por definición.

Los archivos del SPEC (spec.md, plan.md, tasks.md) sí viven dentro de `002-2026-PROTECCION-INFANTIL/specs/` porque el radicado 002-PI-202 pertenece a PI (aunque el diff toca también `bi.yml` — es un cambio de infra transversal liderado por PI, coordinado con BI-2 en el brief).

### Diseño de detalle — job sentinel

**Forma canónica del sentinel** (misma para ambos, cambia solo el nombre y la lista de `needs:`):

```yaml
  pi-gate:
    # Sentinel multi-producto (SPEC-299 / BRIEF A-49).
    # Ver .github/workflows/README.md para el patrón completo.
    runs-on: ubuntu-latest
    needs: [should-skip, verificaciones, test-unit, test-integration, test-integration-coverage, journeys, build]
    if: always()
    steps:
      - name: Evaluar veredicto agregado
        run: |
          set -euo pipefail
          if [[ "${{ contains(needs.*.result, 'failure') }}" == "true" ]]; then
            echo "❌ pi-gate: al menos un job requerido falló."
            exit 1
          fi
          if [[ "${{ contains(needs.*.result, 'cancelled') }}" == "true" ]]; then
            echo "❌ pi-gate: al menos un job requerido fue cancelado."
            exit 1
          fi
          echo "✅ pi-gate: todos los jobs requeridos pasaron o fueron skipped."
```

`bi-gate` es idéntico salvo `needs: [verify, typecheck, test-unit, build]` y el nombre.

**Por qué NO se usa `github.event.pull_request.changed_files` para detectar "no aplicó"**: la lógica `needs.*.result` + `if: always()` ya lo cubre — cuando el PR no toca paths PI, GitHub NO arranca los jobs pesados de PI (`if: needs.should-skip.outputs.skip != 'true'` sale falso en unos casos, o el workflow entero no se dispara en otros). El sentinel recibe `skipped` como `result` y devuelve success trivial. Consultar `changed_files` sería lógica duplicada, propensa a errores en push events (no hay PR) y más costosa.

**Por qué `pi-gate` NO depende de `resumen` ni `gate`**:
- `resumen` (SPEC-280) es un job de reporte que corre con `always()` y no debe influir en el veredicto (si falla el pretty-print, no debe bloquear merge).
- `gate` (job actual de PI) es el agregador previo; el sentinel es su reemplazo funcional visto por el ruleset. `gate` se conserva sin tocar (candado) — puede quedar como job interno del workflow o el ruleset lo dejará de mirar cuando `pi-gate` sea el required check. Retiro futuro de `gate` no es alcance de este SPEC.

**Ampliación de `paths`** (ambos workflows):

Antes (PI):
```yaml
paths:
  - "002-2026-PROTECCION-INFANTIL/**"
  - ".github/workflows/ci.yml"
```
Después (PI):
```yaml
paths:
  - "002-2026-PROTECCION-INFANTIL/**"
  - ".github/workflows/**"
```

Antes (BI):
```yaml
paths:
  - "005-2026-BI-INTELIGENCIA-NEGOCIO/**"
```
Después (BI):
```yaml
paths:
  - "005-2026-BI-INTELIGENCIA-NEGOCIO/**"
  - ".github/workflows/**"
```

**README.md** — outline (< 150 líneas):
1. Título + 3 líneas de contexto (problema del ruleset multi-producto).
2. Regla dura: un sentinel por producto.
3. Requisitos por workflow (los tres del FR-008).
4. Plantilla YAML lista para copiar-pegar.
5. Cómo pedir el registro del check a Jelkin (una línea: "abrir issue o mensaje directo con nombre exacto del check").
6. Convención de nombres (`pi-gate`, `bi-gate`, `mod-gate`, `idc-gate`, `sicov-gate`, `sarlaft-gate`).
7. Enlace al SPEC-299 (traza).

## Complexity Tracking

*No hay violaciones de constitución que justificar.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Fases de implementación (previsión — se detalla en tasks.md post-APRUEBO)

1. **Fase 1 · Editar `ci.yml`**: ampliar paths, añadir job `pi-gate`. Local: `yq` o inspección visual; validar sintaxis con `actionlint` si está disponible, si no revisión manual.
2. **Fase 2 · Editar `bi.yml`**: ampliar paths, añadir job `bi-gate`.
3. **Fase 3 · Crear `.github/workflows/README.md`**.
4. **Fase 4 · Commit único doc-first, luego commit YAML**: dos commits pequeños facilitan revisión.
5. **Fase 5 · Rebase + diff pre-push + push único** (D-54): señal `diff pre-push · OK · <N> archivos`.
6. **Fase 6 · Abrir PR contra `main`** con `gh pr create`.
7. **Fase 7 · Verificación en vivo**: `gh pr checks <PR>` — esperar que `pi-gate` y `bi-gate` reporten `success` real, no trivial (US-2 / SC-001). Si algún job real falla, aplica D-55 (máx 2 iteraciones por síntoma).
8. **Fase 8 · Señal `REALIZADO`** con hash + PR + evidencia `gh pr checks: verde total`.

## Puntos que traigo a la compuerta §4

1. **`needs:` de `pi-gate`** — propongo `[should-skip, verificaciones, test-unit, test-integration, test-integration-coverage, journeys, build]`. Excluyo `resumen` (reporte, no gate) y `gate` (agregador viejo, sin tocar por candado). ¿OK?
2. **`needs:` de `bi-gate`** — propongo `[verify, typecheck, test-unit, build]` (los 4 jobs actuales de `bi.yml`). El instructivo decía `verify` + "cualquier otro job que exista": aplico la lista completa. ¿OK?
3. **Sin action-lint** en el pipeline. La validación de la sintaxis YAML del sentinel será: (a) inspección visual, (b) el propio PR de SPEC-299 disparándose = smoke test de "GitHub aceptó la sintaxis". ¿Suficiente o Fábrica quiere que añada un step temporal de `actionlint` en un commit aparte?
4. **Retiro futuro del job `gate`** en `ci.yml`: NO se toca en este SPEC (candado A-49). Queda como known-followup — cuando Jelkin quite `gate` del ruleset y agregue `pi-gate`, otro SPEC puede limpiarlo. ¿OK como followup?
5. **`should-skip` de PI vs. ausencia en BI**: hoy PI skipea commits doc-only; BI corre completo aunque el cambio sea un README. Es asimetría documentada en Edge Cases del spec — no la resuelvo aquí porque tocar BI más allá del sentinel viola el candado y la asimetría no afecta el veredicto (solo el consumo de minutos de runner). ¿OK aceptarla como known limitation?
6. **README.md ubicación**: raíz de `.github/workflows/README.md` (no dentro de un producto). Confirmado por el brief. Sin duda pero lo dejo explícito.
7. **Naming del check en GitHub**: por defecto, GitHub Actions usa el nombre del job (`pi-gate`, `bi-gate`) — no defino `name:` a nivel de job para no duplicar. ¿OK?
