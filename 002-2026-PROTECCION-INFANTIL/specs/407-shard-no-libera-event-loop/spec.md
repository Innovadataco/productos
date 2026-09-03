# SPEC-407 · I-282 — el shard de test-integration no libera el event loop

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (idc-c0) · **Origen**: veredicto CEO 13:39 (I-282 · SPEC-396 fue causa raíz PARCIAL)

## Para qué

El post-mortem de idc-f5 y el diagnóstico de SPEC-396 declararon que la causa raíz de I-282 era la falta de `concurrency` en los workflows. **Fue causa raíz parcial**: hoy 03-09, con `concurrency` ya activo y `disposeBoss` en test-setup, los shards **volvieron a caer** con "GitHub Actions internal error" a los 16m34s. La evidencia dura (comparación de logs de shard rojo vs verde del run `33777723622`) muestra el mecanismo real:

- **Shard 1 (rojo)**: `Test Files 120 passed (120)` @ 17:28:56 → `Cleaning up orphan processes` @ 17:29:01 → GHA reporta "internal error".
- **Shard 3 (verde)**: `Test Files 121 passed (121)` @ 16:34:30 → `Cleaning up orphan processes` @ 16:34:34 → step exit 0.

Mismo cierre exacto. La única diferencia es **suerte** — si Node terminó de salir antes de que Actions matara el orphan, verde; si no, rojo. **El fork de vitest deja handles vivos al terminar** y `disposeBoss` solo cierra pg-boss.

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

## Fuera de alcance (siguiente PR — solo con luz verde del CEO)

- Fix de `disposeBoss`: `prisma.$disconnect()` en `afterAll`, disposers para ollama-client y cache-semantico, auditoría de `setInterval`/`setTimeout` sin `.unref()`.
- Criterio de cierre del CEO: **20 corridas seguidas sin "internal error"**. Se definirá cómo medirlo (workflow_dispatch con matrix de 20, o script que analice N últimos runs) en el PR de fix.
