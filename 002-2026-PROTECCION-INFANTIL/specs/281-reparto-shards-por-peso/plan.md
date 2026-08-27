# Plan de implementación — SPEC-281 · Reparto de shards por peso

## Alcance del trabajo

Reemplazar el reparto por orden alfabético (`--shard=N/4` puro) por un reparto por peso medido, usando un JSON versionado (`test-durations.json`) que se actualiza automáticamente cada vez que corre el CI en la rama base. Todo el mecanismo es un script Node de ~80 líneas + un cambio de 2 líneas en `ci.yml`.

## Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `test-durations.json` (nuevo, raíz) | Seed inicial con las duraciones medidas en la corrida `33000563200` del brief §4.5 (los 8 archivos caros con sus segundos). El resto queda vacío; el fallback del FR-007 los mete al shard más liviano. |
| `scripts/ci/reparto-shards.mjs` (nuevo) | Algoritmo greedy: lee `test-durations.json`, ordena descendente por duración, asigna cada archivo al shard con menor suma. Imprime la lista del shard pedido. |
| `scripts/ci/actualizar-duraciones.mjs` (nuevo) | Lee `vitest-results.json` de la corrida completa, hace media móvil (últimas 5) con lo que ya está en `test-durations.json` y reescribe el archivo. |
| `.github/workflows/ci.yml` | En `test-integration`: cambia el comando de `vitest --shard=N/4` a `vitest $(node scripts/ci/reparto-shards.mjs --shard=N/4 --durations test-durations.json)`. En `test-integration-coverage`: agrega paso `node scripts/ci/actualizar-duraciones.mjs` solo cuando `github.ref == 'refs/heads/feature/001-scaffolding'`. |
| `scripts/ci/reparto-shards.test.mjs` (nuevo) | Test unitario del algoritmo (entradas fijas → asignaciones esperadas + verificación de determinismo). |

## Diseño técnico

### Algoritmo de reparto (greedy LPT)

```js
export function repartirEnShards(archivosConDuracion, numShards) {
    const shards = Array.from({ length: numShards }, () => ({ archivos: [], totalMs: 0 }));
    const ordenados = [...archivosConDuracion].sort((a, b) => b.duracionMs - a.duracionMs);
    for (const item of ordenados) {
        const shardMasLiviano = shards.reduce((min, s) => s.totalMs < min.totalMs ? s : min);
        shardMasLiviano.archivos.push(item.archivo);
        shardMasLiviano.totalMs += item.duracionMs;
    }
    return shards;
}
```

LPT (Longest Processing Time first) tiene garantía teórica de `4/3` respecto al óptimo: si el óptimo son 14 min, LPT queda en peor caso ~18 min. En la práctica, sobre las duraciones reales del brief §4.5, el desbalance esperado es < 60 s.

### Fallback y archivos nuevos

Un archivo del filesystem que no aparece en `test-durations.json` recibe la mediana de las duraciones conocidas (o 10 s si el mapa está vacío). El script lista los archivos de disco vía `glob('src/**/*.test.{ts,tsx}')` + los excludes de `vitest.config.ts` (se reusa `UNIT_TEST_INCLUDES` para excluir unitarios).

Si el JSON no existe o está corrupto: `console.error("[reparto-shards] fallback a --shard=N/4"); process.exit(0)` sin imprimir lista — el shell (`$(node ...)`) queda vacío, y `vitest` sin positional args aplica el `--shard=N/4` original. **No rompe el CI el primer día.**

### Actualización de duraciones (media móvil)

Nueva `test-durations.json` = media móvil ponderada de las últimas 5 corridas:

```js
const nuevaDuracion = Math.round(0.4 * duracionRun + 0.6 * duracionActualMediaMovil);
```

Se guarda además el timestamp del último update (`_meta.updatedAt`). Los archivos vistos en `vitest-results.json` pero no en `test-durations.json` entran directo (primera medición). Los archivos que llevan > 30 días sin verse (borrados o renombrados) se eliminan del JSON.

### Compatibilidad con vitest actual

`vitest run file1.test.ts file2.test.ts ...` funciona en Vitest 3.x. La bandera `--shard=N/4` se puede omitir cuando se pasan positional args; se deja en el comando para el fallback.

## Riesgo y candados

- **Riesgo bajo**: si el reparto sale mal la primera vez, el CI sigue corriendo — puede que un shard tarde más de lo esperado, pero ningún test se pierde ni se duplica (el algoritmo garantiza cobertura completa y sin solapamiento).
- **SC-005 (no perder pruebas)**: el script emite `console.error` con la cuenta de archivos totales encontrados y la cuenta asignada. Si `total ≠ suma(shards[].length)`, sale con exit 1 y rompe el CI *antes* de correr vitest — mejor un CI rojo por falla de reparto que un shard silencioso que pierde 30 archivos.
- **SC-009 (sin intermitencias)**: no cambia el aislamiento entre archivos (`fileParallelism: false`, `pool: forks` intactos). Cambiar el reparto NO puede introducir intermitencias porque cada archivo sigue corriendo aislado.
- **Auto-commit de `test-durations.json`**: si el bot de GitHub no tiene permisos de push a la rama base, el paso pinta un warning y sube el JSON como artifact — Fábrica lo commitea a mano en el PR de cierre del lote. **No bloquea CI.**

## Pruebas

- `scripts/ci/reparto-shards.test.mjs`:
  - dado un mapa con las duraciones del brief §4.5 → los 8 archivos caros deben quedar repartidos entre los 4 shards (no todos en el mismo).
  - dos ejecuciones con el mismo input → misma salida (determinismo).
  - JSON vacío → exit 0 sin listar archivos.
  - archivo del mapa que no existe en disco → se ignora.
- Verificación empírica en el propio PR: abrir el run, mirar la duración de cada shard, verificar que la diferencia sea < 3 min.

## Rollback

Revertir el commit del cambio en `ci.yml` restaura `--shard=N/4` puro. El `test-durations.json` puede quedarse (no molesta) o borrarse en un commit aparte.
