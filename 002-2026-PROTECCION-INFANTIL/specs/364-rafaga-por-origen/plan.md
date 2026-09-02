# Plan · SPEC-364 · A-72 ráfaga por origen

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisión de diseño

**Verificado en fuente antes de tocar (candado 15v5).** El brief partía de
"la tabla `Reporte` no guarda IP → hay que migrar `origenHash` y capturar IP".
Al leer la fuente, tres hechos cambiaron el plan:

1. `FuenteReporte.ipHash` y `fingerprintHash` **ya existen** y se pueblan en vivo
   en el POST de `/api/reportes` vía `crearFuenteReporte` (sal obligatoria, IP
   truncada /24, `x-forwarded-for`). No hace falta migración ni recapturar.
2. Ese `crearFuenteReporte` corre **antes** de encolar el procesamiento
   (`route.ts:230` vs. `sendReporte`), así que la fila de origen ya está cuando
   la guarda de ráfaga evalúa en el pipeline.
3. El GAP real es que el pipeline (`index.ts:107`) marcaba `Reporte.esRafaga`
   con el `detectarRafaga` **por nick**. Ese es el único consumidor de esa
   función (candado 22v5).

### Por qué adaptar `detectarRafaga` y NO cambiar el callsite a `detectarRafagaFuente`

`detectarRafagaFuente` (anti-abuso) ya cuenta por origen, pero **no es un
reemplazo directo**: usa OTROS parámetros (`burstMaxReports`/`burstWindowHours`
del scoring, no `reportes.rafaga.n_reportes`/`ventana_horas` que el brief manda
reusar), no aplica la regla de "historial previo", no marca todos los reportes
del pico y no registra el paso del expediente. Cambiar el callsite a esa función
sería una regresión de semántica del pipeline.

Se adapta `detectarRafaga`: lee el origen del reporte actual desde su
`FuenteReporte` y agrupa el conteo por ese origen (mismo predicado
`ipHash`/`fingerprintHash` que `detectarRafagaFuente`, por consistencia), sin
tocar parámetros, historial-previo, marcado ni logging.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Seguir penalizando corroboración (varios orígenes, mismo nick) | Test: orígenes distintos → `esRafaga=false`, siguen a CLASIFICADO |
| `updateMany` con filtro por relación (`fuente`) — Prisma no lo soporta | Se resuelve con `findMany` de ids + `updateMany` por `id in` |
| Un reporte sin `FuenteReporte` dispara/omite mal la ráfaga | Test: sin origen → `esRafaga=false` (no penalizar); en el camino real siempre hay fuente |
| Romper la regla de historial-previo al agrupar por origen | Test: historial del mismo origen fuera de ventana corta la ráfaga |
| Colisión con A-71 en `finalizacion.ts` | No se toca: `detectarRafaga` solo devuelve el booleano; firma intacta |

## Impacto en arquitectura: sí

Sin modelo ni columna nueva; un callsite cambia de semántica (por nick → por
origen); la query de la ventana pasa a `findMany`+`updateMany` por id. Detalle
en spec.md.
