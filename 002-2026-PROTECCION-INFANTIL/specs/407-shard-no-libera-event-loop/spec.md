# SPEC-407 · I-282 — el shard de test-integration no libera el event loop

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (idc-c0) · **Origen**: veredicto CEO 13:39 (I-282 · SPEC-396 fue causa raíz PARCIAL)

## Para qué

El post-mortem de idc-f5 y el diagnóstico de SPEC-396 declararon que la causa raíz de I-282 era la falta de `concurrency` en los workflows. **Fue causa raíz parcial**: hoy 03-09, con `concurrency` ya activo y `disposeBoss` en test-setup, los shards **volvieron a caer** al menos **5 veces**:

| Run | Shards que cayeron | Timing | Diagnóstico GHA |
|---|---|---|---|
| `33777723622` | (1), (2) | 16m34s exacto ambos | "internal error" |
| (idc-f5 §4)   | (2)      | 35m       | timeout           |
| `33791642493` | (2), (4) | 35m21s exacto ambos | timeout       |
| PR #312       | (4)      | 35m20s    | timeout           |

**Los timings gemelos** (dos shards muriendo al mismo segundo) descartan "test lento": si fuera un test que cuelga, caería uno. Que caigan dos a la vez apunta a algo **compartido en el cierre** que se sincroniza — todos los shards arrancan a la vez, todos terminan sus tests ~a la vez, todos golpean el mismo mecanismo defectuoso a la vez.

Evidencia dura del `33777723622` (comparación de logs shard rojo vs verde):

- **Shard 1 (rojo)**: `Test Files 120 passed (120)` @ 17:28:56 → `Cleaning up orphan processes` @ 17:29:01 → GHA reporta "internal error".
- **Shard 3 (verde)**: `Test Files 121 passed (121)` @ 16:34:30 → `Cleaning up orphan processes` @ 16:34:34 → step exit 0.

Mismo cierre exacto. La única diferencia es **suerte** — si Node terminó de salir antes de que Actions matara el orphan, verde; si no, rojo. **El fork de vitest deja handles vivos al terminar** y `disposeBoss` solo cierra pg-boss.

### Fabrica evidencia falsa — no solo tiempo perdido

Al morir un shard, `test-integration-coverage` recibe **blobs incompletos** (los del shard caído no llegan) y reporta cobertura falsamente baja. Caso medido hoy: PR #312 con `test-integration (4)` cancelado a 35m20s → coverage reportó **35,44 % contra un umbral de 36 %** → `pi-gate` cae en cascada. **Un solo cuelgue = tres checks rojos** (`test-integration (N)` + `test-integration-coverage` + `pi-gate`), y dos de los tres **parecen defectos de calidad reales**.

Consecuencia: alguien puede leer "cobertura por debajo del umbral" y salir a escribir tests para tapar un agujero que no existe, o —peor— **bajar el umbral**. Esto convierte a I-282 de "cuello de botella de tiempo" en "fuente de decisiones incorrectas sobre el estado real del código". Argumento más fuerte que tenemos para arreglarlo, no solo tolerarlo.

## Qué trae

Este PR **NO arregla el bug**. Trae SOLO **instrumentación de medición**, para que el fix se decida sobre la lista real de handles y no sobre hipótesis. Regla del CEO: "encajar no es alcanzar".

### 1) Instrumentación en `src/lib/test-setup.ts` — DEFAULT OFF

Después de correr los disposers registrados en `globalThis.__pi_test_disposers`, si `process.env.VITEST_DEBUG_HANDLES === "1"`:

1. `import("wtfnode").then(w => w.dump())` — imprime la lista humana de handles activos con `console.error`.
2. Dump crudo con `process._getActiveHandles()` / `_getActiveRequests()` — tipos + fd.
3. Registro de `process.once("beforeExit", ...)` que reimprime cuando Node esté a punto de salir. **Si no se dispara nunca, esos handles son los que impiden que salga**.

**Sin la flag, el bloque no ejecuta ni un `console.error`.** El comportamiento es literalmente el mismo del `afterAll` de hoy. Candado del CEO: cero cambios de comportamiento para las suites que hoy pasan.

### 2) Activación en CI solo para esta rama

En `.github/workflows/ci.yml` step "Correr shard N/4", nueva env `VITEST_DEBUG_HANDLES` que se activa **exclusivamente cuando `github.head_ref` empieza con `work/pi-SPEC-407`** (usando `startsWith(...) && '1' || ''`). Cualquier otra rama recibe env vacío → mismo comportamiento de hoy. Se retira del workflow al cerrar la spec.

### 3) `wtfnode` como devDep

`package.json` añade `"wtfnode": "^0.10.1"` en `devDependencies`. Zero producción; solo test-setup lo importa. Import es dinámico (`await import`) para no pagar el costo cuando la flag está apagada.

## Candados

- **Default OFF, flag explícita.** El `if (process.env.VITEST_DEBUG_HANDLES === "1")` protege TODO el bloque nuevo. Ningún test que hoy verdea cambia una línea de output.
- **Import dinámico**. `wtfnode` sólo se carga cuando la flag pide dump; sin flag no toca resolver, ni memory, ni tiempo.
- **Activación por rama en CI**. La variable en el workflow se activa exclusivamente en ramas `work/pi-SPEC-407-*`. Cero afectación a main y a otros PRs.
- **Instrumentación, no fix.** Este PR NO cambia `disposeBoss`, NO cambia el Prisma singleton, NO agrega `$disconnect()`, NO toca `setInterval`/`setTimeout`. Deja la puerta abierta al fix pero no lo empuja.
- **Reversible en un commit.** Retirar el bloque instrumentado + la env del workflow + `wtfnode` devDep es un revert de 4 líneas.

## Impacto en arquitectura: no

Cambio local en el afterAll global de test-setup, protegido por flag. Nueva devDep. Cambio en un step de CI. Sin schema, sin API, sin runtime.

## Cómo se probará

- **Local (ya hecho)**: correr 3 archivos pesados (webhook Resend, embedding repo, procesar-lote) con la flag activa y `NODE_OPTIONS=--trace-exit`. Salida: `handles=3 requests=0` (stdio + Pipe worker↔parent), `beforeExit` no se dispara porque el fork sale limpio. **Local no reproduce el cuelgue** — el problema exige la escala del shard real (120 archivos + `--coverage.enabled` + reporter blob). Este ejercicio descartó como sospechosos: pool pg de Prisma en aislamiento, ollama-client, cache-semantico (a nivel de 3 archivos; no a escala completa).
- **CI (con este PR)**: relanzar el shard 1 en la rama SPEC-407. La env `VITEST_DEBUG_HANDLES=1` va activa por el condicional del workflow. Se lee el log del shard rojo (que vuelve a serlo por I-282 real) y se extrae la lista de handles vivos que dumpeó wtfnode antes del `Cleaning up orphan processes`.

## DoD (de este PR de medición)

- [x] Instrumentación en `test-setup.ts` detrás de flag, verificada localmente que sin flag corre idéntico.
- [x] `wtfnode` en `devDependencies` con lock file al día.
- [x] Env condicional en `ci.yml` que sólo activa la flag en la rama `work/pi-SPEC-407`.
- [ ] `tsc` limpio + tests locales que ya pasaban siguen pasando (no cambio semántico).
- [ ] `specs-discipline` verde: Status DESARROLLO + fila en `specs/README.md` + `plan.md` + `tasks.md`.
- [ ] CI del shard 1 corre con la flag activa y **hay dump de handles en el log**.

## Hallazgo confirmado con evidencia del caso B (runner GHA lento)

Después de instrumentar en CI, se capturó un shard 3 cancelado (`33807417116`) con la flag activa. Comparado contra un shard 3 sano (`33793162640`) de la misma rama y el mismo reparto de 121 archivos:

| medida                                                | sano (33793162640) | caído (33807417116)    |
|---|---|---|
| Archivos ejecutados                                   | 121                | 53                     |
| Tiempo agregado por vitest en esos archivos           | 17.2 min           | **33.2 min en 53**     |
| Media/mediana del ratio caído/sano por archivo común  | —                  | **2.96× / 2.83×**      |
| Archivos con menor duración en el caído               | —                  | **cero**               |
| Handles vivos por archivo en el caído (53 dumps)      | —                  | `handles=3 requests=0` (base) en TODOS |

Top 5 archivos con mayor ratio (todos crecidos, sin outlier singular):

```
6.38× probe-indices.test.ts                       (1.4s → 9s)
5.25× identificador-profesor.test.ts             (12.4s → 65s)
5.14× bitacora-menor.test.ts                     (12.5s → 64s)
4.58× dinero-vs-valor route.test.ts              (9.7s → 44.5s)
4.47× recomendaciones route.test.ts              (8.8s → 39.3s)
```

**Lectura definitiva del caso B**: ni un archivo fue más rápido, ni un outlier singular. El runner de GHA iba **~3× más lento parejo para TODO**. Vecinos ruidosos, VM contendida, hardware compartido. **No es código del proyecto, no es reparto, no es TestMutex** (cada shard tiene su Postgres service container separado, verificado en `ci.yml`).

Esta comparación es el argumento que impide que dentro de un mes alguien vuelva a diagnosticar mal: si un shard tarda >2× la media, la respuesta ya está.

## Fix del caso B (aprobado por CEO 17:3x): reintento por timeout, con traza

Se envuelve el step "Correr shard N/4" en un shell wrapper con `timeout 28m`. Si el comando muere por timeout de shell (**exit 124**, y solo 124), el step corre una segunda vez la misma orden. Cualquier otro exit code (0 = pass, 1 = test fallido, otro) NO reintenta. `timeout-minutes` del job sube a 60 para dar aire a los dos intentos + overhead; **el tope del intento individual sigue siendo 28 min** (más bajo que 35 antes, no se relaja la exigencia por corrida).

Tres candados duros del CEO:

1. **Sólo por timeout, NUNCA por test fallido.** El wrapper mira `exit 124` textual; un test rojo (exit 1) tumba el step sin retry.
2. **El reintento se ve.** `echo "::warning title=Shard N reintentado por timeout::..."` y línea en `$GITHUB_STEP_SUMMARY`. Aparece en el resumen del run, no se disimula.
3. **La tasa se cuenta.** El resumen registra `spec-407-retry: shard N` en `$GITHUB_STEP_SUMMARY`, y el job `resumen` (siguiente PR) puede fallar si la tasa mensual supera un umbral — para que "runner lento" no se convierta en excusa perpetua.

Sin retry silencioso: un reintento que no deja huella oculta el día en que la lentitud SÍ sea culpa nuestra.

### Cómo leer el contador de reintentos — importante para no diagnosticar al revés

**El tope de 28 min por intento deja poco margen.** En la tabla del §"Hallazgo confirmado" la corrida sana más lenta de shard 4 fue **26.3 min** (`33760868129`) — quedan **1.7 min de aire** sobre 28. Consecuencia:

> **Si la tasa de reintentos sube con el tiempo, la primera hipótesis NO es "los runners de GHA empeoraron". La primera hipótesis es "la suite creció y hay que revisar el tope de 28 min".**

Ese es exactamente el error de diagnóstico que este mismo problema ya nos hizo cometer una vez (SPEC-396 declaró causa raíz parcial). Con la suite creciendo cada semana y el margen tan chico, un cambio ordinario (una spec nueva con 10 tests de integration lentos) puede empujar la corrida sana promedio a 27-29 min → **retries que no son runner lento, son suite crecida** dispuestos a leerse mal.

Al revisar la métrica: primero mirar `test-durations.json` y ver si la mediana de duración por shard subió. Solo si esa mediana está estable y aún así los retries suben, entonces sí es el proveedor.

## Fuera de alcance (siguiente PR — solo con luz verde del CEO)

- Caso A · fix de handles al cerrar: `prisma.$disconnect()` en `afterAll`, disposers para ollama-client y cache-semantico, auditoría de `setInterval`/`setTimeout` sin `.unref()`. La instrumentación queda puesta esperando cazar un caso A por aparición natural (paciencia, no forzar).
- Ratchet de tasa de retry (SPEC-407-b): script que analice N últimos runs y falle CI si la tasa supera un umbral (~5%).
- Criterio de cierre del CEO: **20 corridas seguidas sin "internal error"** después de que caso A esté cerrado.
