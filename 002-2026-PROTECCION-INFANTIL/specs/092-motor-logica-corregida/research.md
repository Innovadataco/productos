# Research — 092-motor-logica-corregida

**Fecha**: 2026-07-24 · **Autor**: ODIN

## R1 — Causa raíz del 74%: "todas las preguntas" apagaba conductas reales

El motor 090 exigía que TODAS las preguntas activas se cumplieran para marcar 1. Pero las preguntas de contexto (¿menor?, ¿adulto?, ¿a cambio?, ¿persiste?) no siempre son legibles en el texto aunque la conducta esté presente ("un adulto le pidió fotos íntimas a mi hija de 12 años" fallaba porque no se menciona intercambio). Fix: 1-2 preguntas DECISIVAS por categoría (núcleo factual: la acción + la naturaleza del material/acto), obligatorias; el resto CONTEXTO (se reporta, no bloquea). "Ante la duda, 0" aplica solo a decisivas. Verificación determinista adicional: la categoría solo cumple si TODAS las decisivas aparecen en `preguntasCumplidas` (el modelo las copia verbatim).

## R2 — Sin "principal" por gravedad (decisión CEO)

La severidad (30/60/90) es un número subjetivo sin criterio y NO decide nada de cara al usuario. El motor ya no elige una conducta principal: `categoriasPresentes` (todas las que superan el umbral) ES el resultado. `ClasificacionIA.categoria` (campo requerido por el schema) = la de mayor % (empate → alfabética), solo como estabilidad técnica; la UI lista todas. La severidad sigue SOLO para priorización interna (bandeja del operador), nunca de cara al padre.

## R3 — Guardas baratas antes del paso caro

Antes: ráfaga y doxing se detectaban pero solo se ACTUABA tras gastar embudo + 3 modelos (desperdicio puro). Ahora `aplicarGuardasPrevias` (solo texto/frecuencia) CORTA a REVISION_MANUAL con prioridad antes de cualquier llamada a modelos. Además el RAG se movió DESPUÉS de la deduplicación (antes: si era duplicado, el RAG ya se había gastado). Nuevo orden: embedding → dedup → guardas previas → RAG → rúbrica → PII → guardas posteriores → finalizar.

## R4 — min_text_length: patrón "sembrado pero nadie lee"

`reportes.spam.min_text_length` existía en BD desde el seed pero el valor 20 estaba QUEMADO en 3 lugares (2 componentes del wizard + el schema Zod del backend). Ahora: front lee `/api/config/parametros/publicos` (hook `useMinTextoReporte`) y el backend valida contra el parámetro en la route (el Zod solo exige no-vacío). Lección registrada en docs/deuda-tecnica.md (spec 094).

## R5 — Medición del embudo (US2)

El embudo puede matar la categoría correcta antes de evaluarla. Medición dedicada (`scripts/medir-embudo-092.ts`): corre SOLO el embudo sobre los 200 casos y cuenta en cuántos descarta esperada+secundaria. Resultados en `scripts/simulacion/medicion-embudo-092.json` y análisis en cierre.md (pendiente de la corrida al momento de escribir esto — se reporta al terminar).

## R6 — Compatibilidad del set de preguntas

El JSON del parámetro puede venir del formato viejo (sin `tipo`): la lectura asume "contexto" (tolerante), así un set antiguo sigue funcionando y solo las decisivas explícitas bloquean. El seed reescribe el set al nuevo formato.
