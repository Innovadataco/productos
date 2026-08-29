# Plan de implementación — SPEC-280 · Resumen legible al final de cada corrida

## Alcance del trabajo

Un job nuevo en `.github/workflows/ci.yml` (llamado `resumen`) que corre después de todos los demás con `if: always()`, descarga los blobs de cobertura ya publicados por `test-integration`, calcula tres cifras (duración, cantidad de pruebas, cobertura), y escribe un bloque Markdown al `$GITHUB_STEP_SUMMARY` con el formato acordado en BRIEF §5.4.

**Fuera de alcance de este SPEC:** no se cambia la duración de ningún inspector (eso es SPEC-281..283), no se cambia el ratchet de cobertura (decisión aparte de Jelkin), no se envía notificación por Slack ni por correo (el brief pide solo el resumen en el propio run).

## Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `.github/workflows/ci.yml` | +1 job `resumen` al final, `needs` con los 6 jobs existentes, `if: always()`. Sin modificar los jobs actuales. |
| `scripts/ci/resumen.mjs` (nuevo) | Lee los blobs descargados, corre `vitest --mergeReports --reporter=json`, calcula duración vía `gh api`, imprime el bloque Markdown por stdout. |

## Diseño técnico

### Fuentes de datos

1. **Duración por inspector**: `gh api /repos/${{ github.repository }}/actions/runs/${{ github.run_id }}/jobs --jq '.jobs[] | {name, started_at, completed_at, conclusion}'` — retorna cada job con sus tiempos y estado. El script calcula `Date(completed_at) - Date(started_at)` en segundos.
2. **Número total de pruebas y cobertura**: `npx vitest run --mergeReports blobs --reporter=json --outputFile=vitest-summary.json` produce un JSON con `numTotalTests`, `numPassedTests`, `numFailedTests`, y por cada test file `startTime`/`endTime`. La cobertura se toma del reporte de `--coverage.reporter=json-summary` (agregado como reporter adicional al paso existente).
3. **Primer test fallido**: del mismo JSON, se filtra `testResults[].assertionResults[] | select(.status == "failed")` y se toma `.fullName` del primero.

### Formato del bloque

```markdown
### ✅ CI verde — 13 min 42 s · 1.512 pruebas · cobertura 38 % (piso 36 %)

| Inspector | Estado | Duración |
|---|---|---|
| verificaciones | ✅ | 1 m 52 s |
| test-unit | ✅ | 45 s |
| test-integration parte 1 | ✅ | 4 m 12 s |
| test-integration parte 2 | ✅ | 4 m 08 s |
| test-integration parte 3 | ✅ | 4 m 15 s |
| test-integration parte 4 | ✅ | 4 m 05 s |
| journeys | ✅ | 2 m 21 s |
| build | ✅ | 2 m 07 s |
```

En rojo, la primera línea queda `### ❌ CI rojo — <T> · <N> pruebas · falló: <inspector>` y se añade una tercera fila al final del bloque con `**Falló: <nombre completo del test>**`.

### Manejo de estados especiales

| Estado del job | Se pinta como |
|---|---|
| `success` | ✅ |
| `failure` | ❌ |
| `cancelled` | ⏸️ cancelado |
| `skipped` | (fila omitida) |
| `neutral` / null | ⚠️ desconocido |

Si al descargar artifacts hay menos de 4 blobs de shard, la primera línea añade `⚠️ blobs incompletos (<N>/4)` en vez de crashar el script.

## Riesgo y candados

- **Riesgo bajo**: el job es puramente de reporte. Aunque falle su ejecución, no afecta el estado del gate (el gate depende de los otros 6 jobs, no de `resumen`).
- **Candado (SC-005)**: el número de pruebas que aparece en el resumen se lee del blob mergeado; si baja respecto al último run verde de `main`, el job `resumen` termina con exit code 0 igual (no rompe CI) **pero** pinta la línea en amarillo `⚠️ pruebas: <M> (antes <N>)`. La comparación con la línea base la hace Fábrica en la auditoría del PR, no el CI.
- **Sin dependencias nuevas**: no se instalan librerías; se usa `gh` (pre-instalado), `jq` (pre-instalado en ubuntu-latest) y `node` para el parser.

## Pruebas

- Ejecutar el workflow en el PR de este SPEC → abrir la pestaña "Summary" y verificar los 3 acceptance scenarios.
- Simular localmente con `act -j resumen` (opcional, no requerido para el gate).
- Un test unitario para `scripts/ci/resumen.mjs` que le pase un JSON fijo de vitest y verifique la salida Markdown esperada (`resumen.test.mjs`).

## Rollback

Si el resumen sale mal en el primer run, se revierte el commit que agrega el job — los 6 jobs originales quedan intactos.
