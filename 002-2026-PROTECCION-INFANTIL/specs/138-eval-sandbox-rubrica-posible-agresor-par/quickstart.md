# Quickstart: SPEC-138 — laboratorio alineado con prod

## Qué motor miden las evals

El motor activo lo decide `ia.rubrica.enabled` (D-28). Sandbox, eval-runner y
producción usan TODOS el mismo selector (`clasificarConMotorActivo`): con el flag
activo clasifica la rúbrica; apagado, el legacy de votos. Cada corrida registra
`motorUsado` — al comparar corridas, compara mismo motor.

## `posibleAgresorPar`

Señal derivada de las respuestas de la rúbrica: si la categoría resultante tiene
preguntas de vínculo y el agresor NO resultó adulto/desconocido → `true` (posible par).
Ante duda → `false` (conservador, §1.3). Solo existe en la rama de rúbrica; el legacy
lo reporta `false`. Alimenta `posibleAgresorParRate` (evals) y el badge del detalle del
reporte (admin).

## Probar

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/ai/rubrica.test.ts src/lib/ai/eval-runner.test.ts src/lib/ai/sandbox.ts
```
