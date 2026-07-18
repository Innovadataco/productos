# Reporte de cierre — Spec 013 Administración del Motor IA desde el Panel

> **Documentado retroactivamente el 2026-07-18** derivado de [`spec.md`](spec.md) y `IMPLEMENTATION-REPORT.md`.

## Estado

**CERRADA** — fecha de cierre: 2026-07-17.

## Resumen ejecutivo

Se implementó la administración del motor IA desde el panel: modelos locales, URL de Ollama validada por privacidad, gestión del fixture de eval en `CasoEval`, corridas en background con `EvalRun` y anti-leakage garantizado.

## Alcance entregado

- Decisión de arquitectura: **solo modelos locales** (R2); URLs cloud rechazadas.
- Validación de URL local/privada en `src/lib/ai/ollama-config.ts`.
- Modelos `CasoEval` y `EvalRun` con estados y fixtureVersion.
- Migración `20260717020000_add_caso_eval`.
- Seed de 110 casos desde `scripts/eval-fixture.json`.
- Endpoints admin para modelos, prueba de conexión, casos de eval, corridas e historial.
- Worker en cola `eval-classifier-run` con candado de una corrida a la vez.
- UI con tabs Modelos y Eval.
- Test anti-leakage: `src/lib/ai/dataset-retrieval.test.ts`.

## Verificaciones de cierre

| Verificación | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✅ |
| TypeScript | `npx tsc --noEmit` | ✅ |
| Build | `npm run build` | ✅ |
| Tests | `npm test` | ✅ 140/140 |
| Smoke E2E | `scripts/smoke-e2e.ts` | ✅ |
| Eval F7 no-regresión | `fixtureVersion=1` | ✅ accuracy 68.2 %, error silencioso 20.8 % |
| Migración sobre BD poblada | rollback → re-aplicación | ✅ |

## Decisiones clave

- El eval de PII queda fuera del panel porque su schema no encaja en `CasoEval`.
- Cambiar modelo/URL **no reprocesa reportes existentes**.
- Cada cambio de fixture incrementa `fixtureVersion`; las métricas anteriores quedan asociadas a la versión anterior.

## Pendientes derivados

- Ver [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md): N2 (modelo de desempate), N6 (eval de PII administrable), N7 (14 casos dudosos).
