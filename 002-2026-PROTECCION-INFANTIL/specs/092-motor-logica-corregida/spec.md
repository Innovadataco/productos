# Spec 092 — Motor: lógica corregida y validada

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-24
**Cola nocturna 008** (1/3)

**Input**: el motor rúbrica rindió 74% con 15 subestimaciones sobre el banco de 200. Diagnóstico de ZEUS: la lógica, no los modelos. NO se cambia la terna ni el umbral (60%) — una variable a la vez.

## User Stories

### US1 — Preguntas DECISIVAS vs de CONTEXTO (P1, causa raíz)

Hoy "marca 1 solo si TODAS las preguntas se cumplen" apaga conductas reales. Cada categoría tendrá 1-2 preguntas **decisivas** (núcleo, obligatorias) y el resto de **contexto** (suman confianza, no bloquean). La categoría marca 1 si se cumplen las decisivas. "Ante la duda, 0" aplica solo a las decisivas. Estructura parametrizable: cada pregunta lleva `tipo: "decisiva" | "contexto"`. Reestructurar el set semilla.

### US2 — Medir el embudo antes de confiar (P1)

El embudo descarta categorías antes de evaluarlas; si mata la correcta, ninguna pregunta la salva. Medir sobre los 200 casos: ¿en cuántos fallos el embudo descartó la categoría correcta? Si es significativo, hacerlo más permisivo (o desactivarlo) y documentar el criterio.

### US3 — Mostrar TODAS las conductas, sin "principal" por gravedad (P1)

Decisión CEO: los números de gravedad NO deciden de cara al usuario. Se eliminan del flujo de decisión: ≥1 categoría supera el umbral → PROCESADO mostrando TODAS; ninguna → revisión humana. La gravedad solo prioriza la bandeja del operador (interno). Reconciliar con `esReporteAprobado` (cuenta una vez; sus conductas se listan).

### US4 — Guardas baratas ANTES del paso caro (P1)

Partir las guardas: PREVIAS (ráfaga, doxing — solo texto/frecuencia) que CORTAN a revisión sin clasificar; POSTERIORES (spam del modelo, keywords+OTRO) se quedan. Mover el RAG DESPUÉS de la deduplicación (hoy corre antes y se gasta en vano si es duplicado).

### US5 — Longitud mínima parametrizada (P1)

`reportes.spam.min_text_length = 20` está sembrado pero nadie lo lee; el 20 está quemado en `ReporteStepDetalle.tsx:118`, `ReporteStepDescripcion.tsx:5` y en `validators.ts` (`z.string().min(20)`) — viola ADR_004. Front Y backend leen el parámetro.

### US6 — Re-correr el banco de 200 y analizar los fallos (P1)

Misma terna, mismo umbral, lógica corregida. Reportar accuracy, silenciosos, subestimaciones, ESPS vs la corrida anterior. Analizar fallo por fallo con la matriz (¿qué pregunta falló?) y marcar ETIQUETAS SOSPECHOSAS del banco para revisión del CEO (ya pasó con #43). La comparación debe quedar corrible desde el tab Eval (o documentar el pendiente).

## Requirements

- **FR-001**: `PreguntaRubrica` con `tipo`; la categoría cumple si todas sus **decisivas** se cumplen (contexto no bloquea). Migración del set semilla al nuevo formato + tolerancia al formato viejo.
- **FR-002**: Medición del embudo sobre el banco (script): fallos atribuibles a descarte erróneo de la esperada. Criterio documentado si se ajusta.
- **FR-003**: Sin selección de principal por gravedad en el motor: `categoriasPresentes` completa es el resultado; `categoria` de `ClasificacionIA` = primera presente por orden de umbral% (estable) solo como campo requerido por el schema — la UI lista todas.
- **FR-004**: Guardas previas (ráfaga por frecuencia, doxing por patrones) cortan a `REVISION_MANUAL` antes del embudo/rúbrica; RAG después de dedup.
- **FR-005**: `reportes.spam.min_text_length` leído por front (pasos del wizard) y backend (`crearReporteSchema` o validación equivalente).
- **FR-006**: Re-corrida del banco con la nueva lógica + análisis de fallos + lista de etiquetas sospechosas.
- **FR-007**: Migraciones aditivas; nada quemado; no rompe 089/090/091; tests de cada regla.

## Success Criteria

- **SC-001**: Tests: decisiva/contexto (contexto no apaga), embudo medido, todas-las-conductas, guardas previas cortan antes de llamar modelos, min_length desde parámetro.
- **SC-002**: Tabla comparativa banco 200: lógica vieja vs nueva (misma terna/umbral) + análisis de fallos + lista de etiquetas sospechosas.
- **SC-003**: Gate completo + commit/push con staging explícito del 002.
