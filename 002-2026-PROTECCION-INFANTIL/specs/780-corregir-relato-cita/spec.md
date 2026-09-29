# SPEC-780 · Corregir el relato de la cita (rectificación · habeas data)

**Feature Branch**: `work/pi-SPEC-780-corregir-relato-cita`
**Created**: 2026-09-29
**Status**: DESARROLLO (motor + camino sancionado + copy; el copy §3 y su render viven en el canal de «Mis datos» de 752/772)
**Base**: `main` (`100717502` al radicar)
**Origen**: al medir habeas data (SPEC-772), Dev-1 encontró `SolicitudCita.presentacion` (el relato) sin ninguna puerta de corrección → aceptaríamos una obligación legal incumplible.

## El defecto

`SolicitudCita.presentacion` se escribe solo al crear; ningún camino humano la modifica (el repo solo tocaba `estado`/`enlaceOperadorId`). La rectificación es un derecho (Ley 1581) y el relato **no es evidencia bajo deber de conservación** — negar su corrección no tiene fundamento.

**Segundo hallazgo (el que muerde):** reprogramar/reasignar **COPIA** `original.presentacion` verbatim a una fila nueva (`cita.service.ts:291,342`). El dato se multiplica: corregir una fila deja las copias mintiendo si no se distingue viva de historial.

## Alcance — tres piezas

1. **Camino sancionado** (`corregir-relato.service.ts` + `PATCH /api/operador/citas/[id]/relato`): un OPERADOR corrige `presentacion` de la solicitud VIVA. No autoservicio del padre, nunca a mano en la base.
2. **Rastro, no sobrescritura silenciosa:** `AuditLog CITA_PROFESIONAL_RELATO_CORREGIDO` con el HECHO (que hubo corrección y cuándo) — NUNCA el texto (ni anterior ni nuevo); nada del relato viaja a `bi_replica`/`metadatos`.
3. **El historial NO se reescribe, y se le DICE al padre:** el copy del límite (FORMA-SPEC780) dice qué se corrige y qué no (`copy-correccion-relato.ts`). El render vive en el canal de «Mis datos» (752/772).

## Qué es «viva» vs «historial» (verificado)

Reprogramar/reasignar crean una fila nueva con `solicitudPreviaId` → la original queda con SUCESOR. **Una fila con sucesor es historial** (un pedido anterior de la cadena). El service corrige solo filas SIN sucesor (la viva) y rechaza las que tienen sucesor.

## [INTERPRETACIÓN LEGAL — al paquete del abogado, no cerrada por Dev ni CEO]

Las filas viejas **se conservan** (no se corrigen). Motivo (lectura del CEO): no son copias rancias de un dato — son **registros de pedidos DISTINTOS**, verdaderos sobre el pasado (en la fecha D el padre pidió una cita diciendo X). Corregirlas las volvería **falsas**, y un profesional actuó sobre lo que leyó entonces.

**Es una interpretación, no una certeza.** Va como tensión al abogado: **«¿la rectificación (habeas data) alcanza a los registros históricos de pedidos anteriores?»** con la lectura del CEO enunciada. **Si el abogado dice otra cosa, cambia la CONDUCTA (habría que corregir/suprimir las copias), no solo el texto.** La línea de copy §3 (la «salida» para las versiones anteriores) depende de esta respuesta y la redacta Diseño con el motivo.

## Candados

- **Conteo de la cadena (el criterio del CEO):** sembrada una cadena de reprogramación, corregir toca SOLO la viva y conserva el historial — se afirma explícitamente cuántas filas cambiaron (1) y cuántas se conservaron (N).
- **Historial no se corrige:** una fila con sucesor → rechazo; la viva → se corrige (mutación).
- **El texto no entra al registro del hecho** (plantado y afirmado ausente).
- **El copy dice el límite** (las versiones anteriores no cambian + el profesional ya leyó) y nunca promete borrado.

## Impacto en arquitectura:

- **Esquema:** un valor nuevo de enum `AccionAudit` (`CITA_PROFESIONAL_RELATO_CORREGIDO`) + su migración aditiva (`ALTER TYPE ADD VALUE`). Sin tablas ni columnas nuevas. Regenerado el cliente; `historial:check` verde.
- **Superficie:** un endpoint nuevo (`PATCH /api/operador/citas/[id]/relato`) y dos métodos de repo (`findParaCorreccionRelato`, `corregirRelato`); el repo antes no editaba contenido de cita.
- **Sin cablear aún:** el copy y la petición del padre viven en el canal de «Mis datos» (752/772) — el módulo de copy queda hueco-funcional hasta ese render.

## Fuera de alcance

La supresión del contenido del **reporte** (DEK compartida → [ABOGADO], 772) · el mecanismo de petición/término/estado (772) · autoservicio de edición del padre.
