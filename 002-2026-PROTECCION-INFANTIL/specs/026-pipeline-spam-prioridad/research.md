> # Research — Pipeline de spam + prioridad + reintentos

**Date**: 2026-07-18
**Feature**: specs/026-pipeline-spam-prioridad/spec.md

---

## Decisión D1: Spam como categoría del clasificador existente, no modelo dedicado

### Opciones consideradas

| Opción | Pros | Contras |
|--------|------|---------|
| Modelo dedicado de spam | Especializado, rápido | Nueva dependencia, entrenamiento, mantenimiento |
| Categoría `SPAM` en `ornith:9b` + RAG | Reutiliza infraestructura existente; RAG se actualiza con ejemplos | Depende de calidad del RAG; puede confundirse con reportes reales ambiguos |
| Reglas heurísticas de contenido | Rápido, simple | Mata reportes reales (bug actual) |

**Decisión**: Agregar `SPAM` como valor de `CategoriaConducta` y entrenar el RAG con ejemplos de spam revisados por operadores.

**Cómo la IA distingue spam de real**:
- El RAG provee ejemplos etiquetados de spam (textos sin narrativa de grooming, con patrones promocionales, repetición de palabras comerciales, ausencia de contexto de menores).
- El clasificador `ornith:9b` vota entre las categorías existentes más `SPAM`.
- Si la confianza en `SPAM` supera `clasificacion.umbral_spam`, el reporte pasa a revisión humana (`POSIBLE_SPAM`).
- No hay autodestrucción: un operador valida la decisión.

**Mitigación de error**: reporte real con vocabulario comercial será clasificado como `SPAM` dudoso → revisión humana → operador lo corrige → se alimenta el RAG con ejemplo negativo.

---

## Decisión D2: Reintentos en tabla propia `ReintentoReporte`

Se evaluó usar metadata de `pg-boss` para historial de intentos, pero:
- pg-boss no expone fácilmente el error completo de cada intento en una API limpia.
- La metadata de pg-boss es transitoria y depende de la configuración de retención.
- El operador necesita ver un timeline claro de intentos.

**Decisión**: tabla propia `ReintentoReporte` controlada por la aplicación. Cada ejecución del worker (éxito o fracaso) escribe una fila.

---

## Decisión D3: Prioridad nativa de pg-boss

`pg-boss` soporta `priority` en `send()` (mayor número = mayor prioridad). Se usará:
- Autenticado o anónimo + keyword de alto riesgo: `priority = 10`.
- Anónimo base: `priority = 1`.

Esto no requiere dependencias nuevas.

---

## Open questions

1. ¿El estado final de spam confirmado es `eliminado=true` o un estado nuevo `SPAM_CONFIRMADO`? Decisión pendiente del owner; por ahora se propone baja con `motivoBaja = RETIRO_LIMPIEZA`.
2. ¿Cuántos ejemplos de spam sembrar en el RAG inicial? Mínimo 20-30 revisados manualmente.
