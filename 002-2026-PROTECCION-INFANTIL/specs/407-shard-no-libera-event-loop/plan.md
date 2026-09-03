# Plan · SPEC-407 · I-282 — instrumentación de medición

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (idc-c0)

## Decisiones

**Instrumentación separada del fix, en su propio PR.** El CEO fue explícito: "si adivinamos, arreglamos lo que no era y el síntoma vuelve, que es exactamente lo que pasó con `concurrency`". El primer PR entrega **medición** (default OFF); el segundo, con la lista de handles reales en la mano, entrega **fix**. Cero riesgo de tocar `afterAll` global con hipótesis.

**Flag explícita `VITEST_DEBUG_HANDLES=1`, no default ON.** Aunque `console.error` es "casi" invisible, algún test podría inspeccionar stderr o simplemente sumar ruido innecesario. Con flag OFF el bloque no ejecuta NADA, ni `import("wtfnode")`. El default es "producción como hoy".

**Import dinámico de `wtfnode`.** Sin la flag no hay `import`, no hay penalidad de load. Con la flag, `await import("wtfnode")` ocurre una única vez en el `afterAll` global del fork.

**Activación de la flag en CI restringida por `head_ref`.** La env `VITEST_DEBUG_HANDLES` se pone a `'1'` en el step "Correr shard" solo cuando `startsWith(github.head_ref, 'work/pi-SPEC-407')`. Cualquier otro PR ve la env vacía → comportamiento intacto. `main` idem.

**`wtfnode` como devDep, no dep.** No lo importa nada en producción. Puramente medición de tests.

**Dos fuentes de información redundantes en el dump**: wtfnode (humano) + `process._getActiveHandles()`/`Requests()` (crudo con `constructor.name` y `fd`). wtfnode a veces filtra su propio output; el crudo es prueba directa de lo que Node considera vivo.

**Registro de `beforeExit` una vez.** Si Node llega a `beforeExit`, imprimimos dump de nuevo — si NO llega (proceso muere por SIGKILL de Actions), el silencio ES la evidencia de que quedaron handles no drenables.

## Archivos

- **EDIT** `src/lib/test-setup.ts` — bloque nuevo en el `afterAll` global detrás de la flag.
- **EDIT** `package.json` + `package-lock.json` — `wtfnode` como devDep.
- **EDIT** `.github/workflows/ci.yml` — env condicional en el step del shard.
- **NUEVO** `specs/407-shard-no-libera-event-loop/{spec,plan,tasks}.md`.
- **EDIT** `specs/README.md` — fila 407.

## Riesgos

- **Ruido en stderr con la flag activa**: puede confundir en `journeys` u otros jobs que inspeccionen stderr. Mitigación: la env sólo se activa en `test-integration` step (línea 194), no en journeys/build/verificaciones.
- **`wtfnode` incompatible con Node 24**: probado local con Node del worktree, imprime bien. Si en CI se rompe, el `try/catch` alrededor evita reventar el fork; peor caso el crudo sigue funcionando.
- **CI de un PR ajeno mergeando con este a medias**: como la flag se activa por `head_ref`, si mergean primero mi rama y el CEO deja `wtfnode` en devDep, es aditivo puro. Y la env condicional queda dormida (no hay rama `work/pi-SPEC-407-*` viva) — no dispara nada.
