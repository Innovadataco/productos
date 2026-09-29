# SPEC-753 · Encuestas de servicio de la sesión + cruce de contradicciones

**Feature Branch**: `work/pi-SPEC-753-encuestas-cruce`
**Created**: 2026-09-29
**Status**: DESARROLLO (motor de detección + candados; el endpoint de ENVÍO es pieza posterior)
**Base**: `main` (incluye SPEC-768 días hábiles) + esquema de Datos de 753 (EncuestaCita, IncidenteContradiccionEncuesta, `duracion` nulable + CHECK espejo `07fa8f7ab`).

## Contexto

Tras una cita CUMPLIDA, el padre y el profesional responden la MISMA encuesta de servicio (5 preguntas que CRUZAN — mismo hecho observable por ambos, texto en `LEGAL/ENCUESTA-SERVICIO-SESION-v0.1`). Cuando existen las dos encuestas, el **cruce** compara las respuestas y, por cada contradicción, registra un `IncidenteContradiccionEncuesta` con su reloj legal. El estado del incidente se **deriva** del reloj (`estadoEfectivoIncidente`); no se persiste.

## Decisión · el término del incidente es SIMÉTRICO (por CLASE), en un solo mapa

El plazo depende de **quién afirmó la no-prestación** (decisión CEO 29-09), igual que en 752 depende del motivo. Fuente única `plazo-incidente.ts` (`PLAZO_POR_CLASE`), cada entrada marcando **legal vs interno**, el legal **clavado por candado**:

| Clase | Cuándo | Término | Ancla |
|---|---|---|---|
| `NO_PRESTACION_RECLAMO_PADRE` | el PADRE dice que no se realizó, el profesional que sí | **LEGAL 15 hábiles** (Decreto 1074/2015 art. 51, reversión) | `respondidaEn` del padre — **su respuesta ES el reclamo** |
| `NO_PRESTACION_DICHA_PROFESIONAL` | el PROFESIONAL dice que no, el padre que sí | INTERNO 10 hábiles | detección |
| `DISCREPANCIA_SERVICIO` | ambos realizaron, difieren en operador/inicio/enlace/duración | INTERNO 10 hábiles | detección |

- **Ancla legal = la respuesta del padre**, no la fecha de la cita (el reloj correría antes de existir reclamo) ni la detección (nos daría más tiempo del que el reclamo justifica).
- **Interno = 10, deliberadamente distinto del legal (15).** Dos términos que deben permanecer distinguibles no comparten valor por defecto: si ambos fueran 15, un candado que afirma «el legal es 15» pasaría igual con la constante equivocada, una «simplificación» los fusionaría sin ponerse rojo, y un cambio de la ley arrastraría el interno en silencio. 10 < 15 → el interno cae **antes**, con holgura.
- Invariantes: `venceEn` NOT NULL, calculado con `sumarDiasHabilesColombia`; el estado no puede mentir sobre el reloj (resolver después de `venceEn` es **RESUELTO_TARDE**, no «resuelto»); `esIncumplimiento` es la fuente única del conteo (incluye las tardías).

## Criterio · por qué la discrepancia de servicio es INTERNA (frontera del Estatuto del Consumidor)

Un padre que reporta 10 minutos donde se prometieron 50 está diciendo que recibió menos de lo pactado, y eso tiene aire de reclamo de calidad. El diseño la trata como **interna** a propósito, y la razón queda escrita para que no se lea como descuido:

> La encuesta es un **instrumento de medición, no un canal de reclamo**. El padre responde datos; no está radicando nada. El canal de reclamo existe **aparte** (los motivos de PQR de SPEC-752, con habeas data de primero). Por eso una discrepancia detectada por cruce de encuestas es **interna**: la abrimos nosotros, no la radicó nadie.

**Condición única que esto impone:** el manejo interno **no puede volverse el único recurso del padre**. Si el incidente queda interno y el padre nunca se entera, está bien — **siempre que el canal de PQR siga abierto e independiente**. No se construye nada que lo cierre, lo consuma ni lo «resuelva por él».

## Reglas de detección (las que siembra el poblador — referencia del equipo)

- Difieren en SE_REALIZO → UNA sola contradicción (SE_REALIZO); las sub-preguntas quedan mudas (un lado describe un servicio que el otro dice que no ocurrió).
- Ambos coinciden en que NO se realizó → NINGUNA contradicción (no hubo servicio del cual contradecir un detalle; `duracion` es NULL en ambos).
- Ambos coinciden en que SÍ se realizó → se cruzan los 4 detalles; una contradicción por pregunta divergente (`duracion` no-nula garantizada por el CHECK duracion-IFF).
- Idempotente: `@@unique([solicitudId, pregunta])` + upsert con update vacío → re-cruzar no duplica ni resetea el reloj.

## Alcance de esta entrega

Motor de detección (`encuestas-cita-cruce.service.ts`) + el mapa de plazos + candados (paridad claves↔enums, plazo por clase con el legal clavado, integración del cruce contra la BD). El **endpoint de envío** de la encuesta —que llamará a `cruzarEncuestasCita`— es pieza posterior; hasta entonces el service es **hueco-funcional declarado** (con su condición de salida en la allowlist de huérfanos).

## Impacto en arquitectura:

- **Esquema:** NINGÚN cambio propio en esta entrega — se LEE el esquema de Datos (EncuestaCita, IncidenteContradiccionEncuesta, `duracion` nulable + CHECK espejo). El artefacto de esquema y su migración son de Datos (D-121). No se regenera `01-modelo-datos.md`.
- **Módulos nuevos:** `plazo-incidente.ts` (fuente única del término por clase) + `encuestas-cita-cruce.service.ts` (motor de detección). Ambos hueco-funcional declarados hasta que el endpoint de envío los importe.
- **Proxy / navegación / stack:** sin cambios. Esta entrega no agrega ruta, pantalla ni ítem de menú (el endpoint de envío y su superficie son piezas posteriores).
- **Acceso a datos:** el service NO importa el singleton de Prisma (Q-3); recibe el cliente/tx del llamador. Lee `encuestaCita` y hace `upsert` idempotente de `incidenteContradiccionEncuesta`.
