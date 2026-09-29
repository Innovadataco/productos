# SPEC-753 · Plan

## Enfoque

Se construye SOBRE el esquema de Datos (D-121): EncuestaCita + IncidenteContradiccionEncuesta + `duracion` nulable con CHECK espejo. Esta entrega es el **motor de detección** (lógica pura + persistencia idempotente del incidente) y sus candados; el **endpoint de envío** que dispara el cruce es pieza posterior.

## Capas

1. **Fuente única del término** (`plazo-incidente.ts`): mapa `PLAZO_POR_CLASE` (clase → { díasHábiles, legal, ancla }). Legal (reclamo del padre) clavado en 15 con ancla en la respuesta del padre; internos en 10 anclados en la detección. `venceEn` con `sumarDiasHabilesColombia` (SPEC-768).
2. **Piezas puras ya existentes** (Datos/Dev-3 previo): `estado-efectivo-incidente.ts` (estado derivado + `esIncumplimiento`), `encuestas-preguntas.ts` (las 5 preguntas, texto legal v0.1).
3. **Service del cruce** (`encuestas-cita-cruce.service.ts`): carga ambas encuestas, `detectarContradicciones`, y upsert idempotente del incidente con reclamadoEn/venceEn según la clase. Cliente inyectado (Q-3), sin singleton.
4. **Candados**: paridad claves↔enums; plazo por clase (legal clavado, legal≠interno); integración del cruce contra la BD (las clases, el ancla, control positivo, ambos-no, idempotencia, no-op sin ambos lados).

## Dependencias / orden

- 768 (días hábiles) en main. ✅
- Esquema de Datos (`07fa8f7ab`). ✅
- Cableado (endpoint de envío que llama `cruzarEncuestasCita`) → PR posterior; hasta entonces hueco-funcional.

## Riesgos

- El ancla legal es un término legal: decidido por el CEO (respuesta del padre = reclamo). No se adivina.
- El término interno se fija DISTINTO del legal a propósito (poder de discriminación del candado).
