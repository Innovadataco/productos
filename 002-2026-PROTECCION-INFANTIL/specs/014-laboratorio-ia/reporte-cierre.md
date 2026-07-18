# Reporte de cierre — Spec 014 Laboratorio de Experimentos IA

> **Documentado retroactivamente el 2026-07-18** derivado de [`spec.md`](spec.md) y `IMPLEMENTATION-REPORT.md`.

## Estado

**CERRADA** — fecha de cierre: 2026-07-17.

## Resumen ejecutivo

Se implementó el Laboratorio de Experimentos IA: corridas congeladas de configuración, métricas por caso, comparador y flujo de activación explícita que nunca muta producción automáticamente.

## Alcance entregado

- Extensión de `EvalRun` con `nombre`, `notas`, `configSnapshot`, `progresoCasos`, `progresoTotal`.
- Nueva tabla `EvalResultado` con detalle por caso.
- Endpoints para crear, listar, detallar, comparar y preparar activación de experimentos.
- Worker reutilizando cola `eval-classifier-run` con validación de modelo instalado.
- UI con Laboratorio (lista, asistente, dashboard, comparador) y Configuración (banner de pre-carga, timeline).
- Baseline definido como último experimento `COMPLETADA` cuyo `configSnapshot` coincide con producción y `fixtureVersion` actual.

## Experimentos documentados

| Experimento | Config | Accuracy | Error silencioso | Revisión manual | Recall OTRO |
|---|---|---|---|---|---|
| Prueba `ornith:35b` | `ornith:35b`, umbral 0.5, 5 votos | 70.0 % | 28.8 % | 5.5 % | 40.0 % |
| Línea de base real | `ornith:9b`, umbral 1.0, 5 votos | 68.2 % | 20.8 % | 34.5 % | 30.0 % |
| Config alternativa | `ornith:9b`, 3 votos | 68.2 % | 30.5 % | 4.5 % | 30.0 % |

## Verificaciones de cierre

| Verificación | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✅ |
| TypeScript | `npx tsc --noEmit` | ✅ |
| Build | `npm run build` | ✅ |
| Tests | `npm test` | ✅ 147/147 |
| Smoke E2E | `scripts/smoke-e2e.ts` | ✅ |
| Migración aplicada | dev y test | ✅ |
| Demo real | A+B+comparador+activar | ✅ |

## Decisiones clave

- Un experimento **es** una corrida de eval; no se creó tabla separada.
- `EVALUAR ≠ ACTIVAR`: el botón "Usar esta configuración" solo pre-carga valores en Configuración vía `localStorage`; activar requiere guardado explícito con `AuditLog` `PARAM_UPDATE`.
- Comparador bloquea experimentos de distinta `fixtureVersion`.

## Pendientes derivados

- Ver [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md): N2 (modelo de desempate), N7 (14 casos dudosos).
