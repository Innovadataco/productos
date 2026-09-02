# Plan · SPEC-368 · A-74 pulido

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisiones

**P0 no se rehízo.** Candado 15v5: antes de codificar se verificó la fuente y el
despliegue. I-245 ya estaba resuelto por SPEC-344 y en producción. Rehacerlo
habría gastado la prioridad más alta en algo ya hecho. En su lugar se cerró el
hueco vecino real (la plantilla del camino guiado sin candado).

**P1: se verificó el RENDER, no el atributo.** El primer análisis (step=3600 ⇒
"ya está cubierto") era insuficiente: el atributo no dice lo que el usuario VE. Al
mirarlo en el navegador se confirmó el segmento de minutos. De ahí el control
propio en vez de seguir peleando con el nativo.

**Los PDFs quedan fuera.** Formatear una evidencia legal no es "presentación";
si se quiere cambiar, se radica aparte.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Perder los candados de B1 al cambiar el control | 7 tests: futuro imposible (tope LOCAL), borde de HOY, hora en punto, error que nombra el campo, contrato de onChange intacto (borrador) |
| Que la plantilla del camino guiado diverja de su validador | Candado nuevo, verificado simulando la divergencia (cae con el síntoma de I-245) |
| Romper el wizard compartido (anónimo + autenticado) | Tests del wizard verdes (14) + verificación en vivo del flujo anónimo |
| Borrar código vivo por error | Cero referencias confirmadas antes de borrar (estáticas, dinámicas, tests, includes) |

## Impacto en arquitectura: no
