# SPEC-364 · A-72 — La ráfaga cuenta por ORIGEN, no por la cuenta reportada

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: A-72 (brief del CEO; Jelkin probando RPT-6DGNC5, ráfaga sobre un nick vía Tor/Brave)

## Qué se arregló

La protección de ráfaga marcaba `Reporte.esRafaga` contando **solo por el
identificador reportado** (nick + plataforma). Resultado: **varias personas
independientes reportando la misma cuenta se marcaban como ráfaga** y caían a
`REVISION_MANUAL`. Eso es al revés del corazón del producto: la corroboración
múltiple FORTALECE el caso, no lo vuelve sospechoso.

Ahora la ráfaga cuenta **por origen**: N reportes sobre el mismo identificador
**desde el mismo origen** dentro de la ventana. Distintos orígenes sobre el
mismo nick = corroboración legítima, no ráfaga.

## De dónde sale el origen (sin infra nueva)

El origen ya se captura: `crearFuenteReporte` corre en el POST de
`/api/reportes` (anónimo y con cuenta) **antes de encolar** el procesamiento, y
guarda `FuenteReporte.ipHash` y `fingerprintHash` — hash con sal obligatoria
`ANTI_ABUSO_SALT`, IP truncada /24 desde `x-forwarded-for` (candado 22v3).
**Nunca IP cruda.** Para cuando la guarda de ráfaga corre en el pipeline, esa
fila ya existe.

Por eso **no hay migración nueva**: la premisa original del brief ("la tabla
`Reporte` no guarda IP") era de la tabla equivocada — el origen vive en
`FuenteReporte`. Corrección v2.0 del brief, verificada en fuente (candado 15v5)
y aprobada por el CEO.

## Cómo quedó

`detectarRafaga` (reporte-processing) ahora lee el origen del reporte actual y
agrupa el conteo por ese origen (`ipHash` o `fingerprintHash`, mismo predicado
que `detectarRafagaFuente` del anti-abuso). Se conserva todo lo demás del
pipeline: los mismos parámetros (`reportes.rafaga.n_reportes` / `ventana_horas`),
la regla de "historial previo" (una relación sostenida no es un pico), el
marcado de todos los reportes del pico y el paso "guardas" del expediente.

- **Sin origen** (reporte sin `FuenteReporte`): no se marca ráfaga. Preferimos
  no penalizar antes que castigar corroboración. En el camino real no ocurre.
- **Tor / IP de salida variable**: los reportes salen como orígenes distintos →
  se respeta el anonimato y la ráfaga solo cae sobre spam desde un origen fijo.
  Aceptable y documentado (brief).

## Impacto en arquitectura: sí

- **No hay modelo ni columna nueva.** Se reusa `FuenteReporte.ipHash` /
  `fingerprintHash` (ya poblados en vivo) — no se duplica la captura de origen.
- **Un solo callsite cambió de semántica**: `reporte-processing/index.ts:107`
  sigue llamando `detectarRafaga`; la función pasó de contar por nick a contar
  por origen. Verificado (candado 22v5) que ese es el único consumidor del
  `detectarRafaga` del pipeline; `finalizacion.ts` solo recibe el booleano
  `esRafaga`, su firma no cambia (coordinación con A-71 sin colisión).
- La query de la ventana pasa a `findMany` + `updateMany` por `id`, porque
  Prisma no filtra por relación (`fuente`) en `updateMany`.

## Cómo se probó

- `reporte-processing/rafagas.test.ts` (4): mismo origen alcanza el umbral →
  ráfaga y marca todos; orígenes distintos → NO ráfaga; sin origen → NO ráfaga;
  historial previo del mismo origen corta la ráfaga.
- `api/reportes/procesar/route.test.ts` (17, incl. el nuevo): 3 reportes del
  mismo nick desde orígenes distintos NO son ráfaga (corroboración, siguen su
  curso a CLASIFICADO); los casos existentes de ráfaga, dados de baja e
  historial se sembraron con origen para ejercer el camino real.
