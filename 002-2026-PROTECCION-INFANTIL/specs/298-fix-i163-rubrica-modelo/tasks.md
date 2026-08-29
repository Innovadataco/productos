# TASKS 298 — Fix I-163: rúbrica respeta `modeloClasificacion` (002-PI-201)

**Status**: `IMPLEMENTADO`
**Ejecutor**: Desarrollo PI-1 (Claude · Dev PI-1 [8e7cb7]) sobre worktree `.worktrees/pi-SPEC-298/`

## Fase 1 · Cambios de código (secuencial)

- [x] **T1** [P] — `src/lib/ai/rubrica.ts`
  - Firma nueva: `clasificarConRubrica(texto, config?, override?)` (3er param opcional).
  - Calcular `modelosVotantes = override?.modeloClasificacion ? [override.modeloClasificacion] : cfg.modelos`.
  - `logger.warn` si el override no está listado en `cfg.modelos` (RF-5).
  - Sustituir `for (const modelo of cfg.modelos)` → `for (const modelo of modelosVotantes)`.
  - **Ajuste RF-6:** `metrics.modelo` se arma con `modelosVotantes.join("+")` (no con `cfg.modelos`), así `ClasificacionIA.modeloUsado` refleja el modelo real cuando llega override.
- [x] **T2** [P] — `src/lib/ai/motor.ts`
  - Ampliar `OpcionesMotor` con `modeloClasificacion?: string | undefined`.
  - En `clasificarConMotorActivo`, propagar `opciones.modeloClasificacion` como 3er argumento (`override`) al llamar a `clasificarConRubrica`.
- [x] **T3** — `src/lib/dal/services/reporte-processing/clasificacion.ts`
  - Línea 70: `clasificarConMotorActivo(texto, { modeloClasificacion: parametros.modeloClasificacion })`.

## Fase 2 · Tests

- [x] **T4** — `src/lib/ai/rubrica.test.ts` — nuevo `describe("clasificarConRubrica — override modeloClasificacion (SPEC-298 / I-163)", ...)` con:
  - **RF-A** — con override → 1 llamada de voto al modelo indicado, `votosModelos.length === 1`, `votosModelos[0].modelo === override`.
  - **RF-B** — sin override → comité completo, `votosModelos.map(v => v.modelo) === cfg.modelos`.
  - **RF-6** — `resultado.metrics.modelo === "rubrica:<override>"` con override, `"rubrica:m1+m2+m3"` sin override.

## Fase 3 · Documentación

- [x] **T5** — Actualizar `spec.md` (Status → IMPLEMENTADO, RF-6, ajuste de tabla) + `plan.md` (§2.1 y §2.4 con RF-6) + este `tasks.md`.

## Fase 4 · Gate local + push

- [ ] **T6** — Gate local:
  - `npx tsc --noEmit`
  - `npx vitest run src/lib/ai/rubrica.test.ts`
  - `npx vitest run` (suite afectada: `rubrica`, `motor`, `reporte-processing`).
  - `npm run lint`
  - `npm run build`
- [ ] **T7** — `git fetch origin && git rebase origin/main && git diff --name-status origin/main..HEAD` + señal a Fábrica.
- [ ] **T8** — Commit único, `git push -u origin work/pi-SPEC-298-fix-i163-rubrica-modelo`, `gh pr create --base main`.
- [ ] **T9** — `gh pr checks <PR>` = **13/13 verde** (regla dura).
- [ ] **T10** — Señal `desarrollo-1: 002-PI-201 · REALIZADO · <hash> · PR #<num> · gh pr checks: 13/13 verde` con la tabla completa.

## Criterios de aceptación (DoD)

1. `rubrica.test.ts` verde con los 3 tests nuevos.
2. `npm run test` completo sin regresiones frente a `main` en `rubrica`, `motor`, `reporte-processing`, `simulacion`.
3. `npx tsc --noEmit` verde.
4. `gh pr checks <PR>` en 13/13 verde antes de la señal REALIZADO.
5. En simulación piloto post-deploy (verificación en vivo), `accuracy` difiere entre `qwen2.5:14b` y `gemma2:27b` y `ClasificacionIA.modeloUsado` refleja cada modelo.
