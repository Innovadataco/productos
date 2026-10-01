# SPEC-794 · Freemium: la suma de meses de vigencia va en calendario Bogotá

**Feature Branch**: `work/pi-SPEC-794-freemium-mes-bogota`
**Created**: 2026-09-30
**Status**: DESARROLLO (hotfix de facturación que desbloquea `main`)
**Base**: `main`

## Contexto · defecto de facturación INTERMITENTE

Al autorizar un pago durante el freemium, `extenderVigenciaDesdeFreemium` fija
`fechaFin = max(freemiumFechaFin, hoy Bogotá) + duracionCubierta (meses)` (FR-005). El cálculo
`calcularFechaFinTrasPagoFreemium` (en `freemium-calculos.ts`) sumaba los meses con `addMonths`
**sobre el instante UTC crudo**, sin convertir a Bogotá — a diferencia de su hermano
`calcularFreemiumFechaFin`, que SÍ cumple el FR-003 del propio módulo («toda la aritmética en día
calendario America/Bogotá»).

`freemiumFechaFin` es **fin-de-día Bogotá** guardado como `04:59:59.999Z` — es decir, el día
**siguiente** en UTC. Cerca de fin de mes el día UTC (p. ej. 31) difiere del día Bogotá (30), y
`addMonths` sobre el instante crudo **recorta sobre el calendario equivocado**. Resultado: **el
cliente que paga cerca de fin de mes recibe un día MENOS de servicio.**

**Es INTERMITENTE** — solo se manifiesta cuando `freemiumFechaFin` cae en una frontera de fin de
mes (días que en UTC son 31 y en Bogotá 30, o la suma clava en febrero). Por eso «funcionaba ayer»:
el defecto estuvo latente hasta que el cambio de mes (corrida pasada la medianoche UTC del 1-oct)
hizo que `freemiumFechaFin` cayera en la frontera. El test de integración T010 lo destapó.

## Reproducción (código corriendo, TZ=UTC = CI)

| cálculo | resultado | Bogotá |
|---|---|---|
| `freemiumFechaFin` | `2026-10-31T04:59:59.999Z` | fin del **30-oct** |
| servicio VIEJO (addMonths crudo) | `2026-11-30T04:59:59.999Z` | fin del **29-nov** ← pierde un día |
| **correcto (Bogotá-aware)** | `2026-12-01T04:59:59.999Z` | fin del **30-nov** |

## Decisión

- **Corrección en el SERVICIO**, no en la expectativa del test. Cambiar la fecha esperada para que
  coincida con el servicio **bendeciría** el error de facturación y lo enterraría.
- `calcularFechaFinTrasPagoFreemium` convierte la base a Bogotá (`toZonedTime`), suma los meses
  —con el clamp cayendo en el calendario correcto— y vuelve a UTC (`fromZonedTime`), como el hermano.
- **Oráculo del test endurecido.** La expectativa de T010 estaba calculada con `setMonth` nativo,
  que acertaba por **azar** (desbordaba al día correcto). Un test que acierta por azar falla por
  azar mañana. La corrección de la aritmética la fijan **tests UNITARIOS de frontera** (fechas fijas,
  deterministas, RED-first); T010 pasa a verificar el **cableado** (que el service persiste lo que el
  cálculo devuelve), sin `setMonth`.

## Alcance

SOLO freemium. El mismo patrón timezone-naive aparece en otros cálculos de facturación
(`admin-autorizar-solicitud`, `referido`, `admin-activacion-manual`, `vigencia-colegio`); NO están
medidos (pueden estar bien si su base es inicio-de-día). Van en SPEC propia, radicada, cuya primera
tarea es MEDIR cada sitio — no arreglar sin medir.

## Impacto en arquitectura:

- **Esquema:** SIN cambios.
- **Módulos:** se corrige `src/lib/pagos/freemium-calculos.ts` (`calcularFechaFinTrasPagoFreemium`).
  No hay módulos nuevos, ni rutas, ni pantallas, ni ítems de menú.
- **Proxy / navegación / stack:** sin cambios.
- **Acceso a datos:** sin cambios. La función es pura (sin Prisma); el service que la llama ya existía.
- **Tests:** 2 casos unitarios de frontera en `freemium-calculos.test.ts` (RED-first) + oráculo
  Bogotá-aware en `freemium.service.integration.test.ts` (T010).
