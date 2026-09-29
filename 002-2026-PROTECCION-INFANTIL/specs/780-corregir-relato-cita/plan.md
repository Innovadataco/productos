# SPEC-780 · Plan

## Enfoque

Habilitar la corrección del relato (`presentacion`) de la cita, verificando primero el modelo real de reprogramación (cadena de filas que COPIAN el relato). Corregir la viva, conservar el historial, dejar rastro sin texto.

## Capas / orden

1. **Esquema:** valor de enum `AccionAudit CITA_PROFESIONAL_RELATO_CORREGIDO` + migración aditiva (`ALTER TYPE ADD VALUE`). Cliente regenerado.
2. **Repo:** `findParaCorreccionRelato` (existencia + si tiene sucesor) + `corregirRelato` (update de solo `presentacion`).
3. **Service:** `corregirRelatoCita` — rechaza filas con sucesor (historial), corrige la viva, `logAudit` del HECHO sin texto.
4. **Camino sancionado:** `PATCH /api/operador/citas/[id]/relato` (verifyAuth OPERADOR → service).
5. **Copy:** `copy-correccion-relato.ts` (§2 de la forma, verbatim) + candado. El §3 (salida de las copias) pende de la respuesta legal.
6. **Candados:** conteo de la cadena, gate de historial, no-texto en el rastro, copy del límite.

## Dependencias

- El render del copy + la petición del padre viven en el canal de «Mis datos» (752/772). El módulo de copy queda hueco-funcional hasta ese cableado.
- Interpretación legal (conservar copias) → tensión al abogado; si cambia, cambia la conducta.

## Riesgos

- Si el modelo de reprogramación no fuera una cadena de filas, se re-examina todo (verificado: SÍ es cadena, `solicitudPreviaId`).
