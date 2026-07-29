# Feature Specification: Vista del padre sin traza técnica del motor

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Status**: FINALIZADO (SIN push ni desplegar; release lo gatea ZEUS)

## Contexto

Medido por ZEUS (cola nocturna 002-PI-041, bloque B2): la vista privada del padre
(`MisReporteDetalle.tsx` + `GET /api/reportes/mis-reportes/[id]`, spec 090-US3) muestra
la traza del motor como si fuera una consola de ingeniería: nombres de modelos
(`aya-expanse:32b`, `gemma2:27b`, `qwen2.5:14b`), votos por modelo, porcentajes de
presencia, análisis con umbrales — **y categorías que el propio sistema DESCARTÓ**
(ej. "Compartimiento sexual · ✓ · 33%" sin alcanzar el umbral). Un padre lee una
acusación que el sistema rechazó, en un caso que involucra a un menor.

Decisiones aplicables: **D-22** (la traza del motor es superficie del admin — vive en el
expediente de spec 096 y no se borra nada), **D-13** (al usuario se le muestran las
conductas DETECTADAS, no las descartadas), **D-23** (mensajes con plantillas
deterministas, nunca salida cruda del modelo), constitución §1.3/§1.5 (sin scores ni
lenguaje de riesgo de cara al usuario).

**Guardas**: NO se toca el motor (rúbrica/umbrales/terna), NO se toca el endpoint admin
del expediente (spec 096), NO se borra ningún dato de la traza.

## Requisitos

- **FR-1 (Crítico)**: la vista del padre muestra SOLO tres cosas: (1) qué conductas se
  identificaron, en lenguaje humano — SOLO las confirmadas (las que superaron el umbral
  en el motor); (2) qué significa eso, con la plantilla determinista existente
  (`mensaje-padre.ts`, D-23) o texto institucional neutro si no hay conductas; (3) qué
  puede hacer: canales oficiales (Línea 141 ICBF, CAI Virtual, Te Protejo), reusando el
  componente existente `CanalesOficiales`.
- **FR-2 (Crítico)**: fuera de la vista del padre, sin excepción: nombres de modelos,
  porcentajes, votos por modelo, categorías descartadas, análisis técnico/umbrales/scores.
- **FR-3**: el endpoint que alimenta el detalle del padre deja de exponer los campos
  técnicos (`votosModelos`, `porcentajes`, `analisis`, `confianza`, scores). Decisión:
  cambio de contrato IN-PLACE (el endpoint es privado del dueño y su único consumidor es
  `MisReporteDetalle.tsx` — verificado por grep); no hace falta una variante nueva. El
  endpoint admin NO se toca.
- **FR-4**: las conductas confirmadas = `ClasificacionIA.categoria` +
  `categoriasSecundarias[].categoria` (el motor ya persiste como secundarias SOLO las que
  superaron el umbral; ver `src/lib/ai/rubrica.ts` — las descartadas quedan en
  `ClasificacionRubricaVoto`, que este endpoint ya no lee). SPAM y OTRO nunca se muestran
  (spec 093-US2).
- **FR-5**: la plantilla del mensaje reutiliza las MISMAS plantillas deterministas del
  expediente (D-23) pero sin el marco de "borrador" (eso es del admin) y sin canales en
  el texto (en la vista los muestra `<CanalesOficiales />`).
- **FR-6**: nada se borra del sistema: la traza completa sigue en el expediente del admin
  (spec 096). Sin migraciones; solo cambian la salida del endpoint y la vista.

## Success Criteria

- **SC-001**: tests — el detalle del padre NO contiene nombres de modelos, porcentajes,
  votos, umbrales ni categorías descartadas (componente + endpoint, con barrido sobre el
  JSON completo).
- **SC-002**: tests — el detalle SÍ contiene las conductas confirmadas con label humano,
  el mensaje de plantilla determinista y los canales oficiales.
- **SC-003**: tests existentes del expediente admin y del motor siguen verdes (la traza
  no se tocó). Gate completo verde (tsc + lint + test + build).

## Assumptions

- El score de `categoriasSecundarias` persistidas es el porcentaje de presencia y el
  motor solo persiste ahí categorías ≥ umbral; por tanto el endpoint del padre no
  recalcula umbrales.
- Reportes históricos con clasificación previa siguen funcionando con el nuevo contrato
  (la lectura es la misma tabla; solo cambia la proyección).

## Implementación (cierre 2026-07-29)

Implementada según plan: `construirExplicacionPadre` en
`src/lib/expediente/mensaje-padre.ts` (plantillas compartidas con el expediente, D-23),
contrato in-place de `GET /api/reportes/mis-reportes/[id]` (solo conductas confirmadas +
mensaje) y vista rehecha en `MisReporteDetalle.tsx` (chips + "Qué significa esto" +
`<CanalesOficiales />`). SC-001/002/003 verificados: 44/44 tests de los archivos tocados
y colindantes verdes (incluido el expediente admin de spec 096, intacto); gate
tsc/lint/build ✅. Detalle y evidencia: [cierre.md](./cierre.md).
