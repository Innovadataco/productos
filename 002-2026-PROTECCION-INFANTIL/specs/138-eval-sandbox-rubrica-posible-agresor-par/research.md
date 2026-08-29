# Research: SPEC-138 — reverificación en fuente (2026-08-01)

## Desalineo verificado (archivo:línea)

- Producción: `reporte-processing/clasificacion.ts:71-76` — `cargarConfigRubrica()` +
  `config.enabled ? clasificarConRubrica : legacy (votos del mismo modelo)`.
- Sandbox: `sandbox.ts:183` — SIEMPRE `clasificarConVotos`.
- Eval-runner: `eval-runner.ts:283` — SIEMPRE `clasificarConVotos`.
- Consecuencia: con la rúbrica activa en prod, las evals y el laboratorio miden otro
  motor. Los números de F7 no predicen prod.

## `posibleAgresorPar`: infraestructura presente, señal ausente

- Tipo en `eval-runner.ts:50` y UI (`eval/types.ts:47`, `reporte-detalle/types.ts:28`).
- Métrica `posibleAgresorParRate` computada sobre `results[].posibleAgresorPar`
  (`eval-runner.ts:138`) — pero `:349` lo hardcodea a `false` en la rama real.
- Guard `leerPosibleAgresorPar` (`clasificacion.ts:34`, de SPEC-136): devuelve false
  porque la rúbrica no lo reporta.
- Display: `ReporteDetalleInfo.tsx:54` (badge cuando es true — nunca se muestra hoy).
- Materia prima para la derivación: preguntas de vínculo en la semilla
  (`rubrica-semilla.ts:34` "¿Quien pide es un adulto o un desconocido?", `:38` "¿La
  propuesta viene de un adulto o un desconocido?").

## Patrón de la solución

E-4 ya unificó guardas (decisión pura única + wrapper productivo). Esto es el mismo
movimiento para el SELECTOR de motor: una función compartida que prod/sandbox/eval
llaman. La reversión en caliente (D-28, `ia.rubrica.enabled`) se conserva como fuente
del switch.

## Límite conocido

La rama legacy de votos no tiene respuestas de rúbrica → no puede calcular
`posibleAgresorPar` (queda `false`, documentado). Si el banco de eval no tiene casos
PAR etiquetados, la métrica será 0 real — se verifica y se reporta en el cierre (no es
defecto, es cobertura del banco).
