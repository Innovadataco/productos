# Data Model: Mejora del prompt del clasificador (Spec 050)

**Date**: 2026-07-20
**Feature**: specs/050-mejora-prompt-clasificador/spec.md

---

## Active Entities

No se modifican entidades ni se añaden campos. El cambio es únicamente textual en el system prompt de `src/lib/ai/classifier.ts`.

---

## Migration Notes

**Ninguna migración requerida.** No se toca el modelo `Reporte`, `ClasificacionIA`, `DatasetEntrenamiento`, `CasoEval` ni ninguna otra tabla. El schema de respuesta de la IA (`classificationResponseSchema`) permanece igual.

---

## Data Flow (sin cambios)

1. El reporte se anonimiza y se encola en pg-boss.
2. El worker invoca `clasificarConVotos` con el modelo base configurado.
3. `buildSystemPrompt` genera el system prompt (incluyendo el texto mejorado).
4. El modelo responde con el JSON estructurado ya definido.
5. Se agregan los votos y, si aplica, se consulta el modelo de desempate.
6. El resultado se persiste en `ClasificacionIA` y `TransicionReporte` como siempre.

---

## Notes

- Aunque no hay cambios de datos, el resultado de la clasificación puede variar (mejor recall en las categorías objetivo) y eso impacta los campos `categoria` y `estado` de `ClasificacionIA` y `Reporte`.
- La validación se mide comparando las categorías asignadas por el modelo con las etiquetas humanas del set de referencia.
