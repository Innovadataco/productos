# Feature Specification: Rediseño del Clasificador IA

**Feature Branch**: `010-rediseño-clasificador-ia`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Rediseño del pipeline de clasificación IA para mejorar precisión, robustez del parseo, detección de PII, multi-label, self-consistency, RAG sobre correcciones de admin, cascada de desempate con modelo grande, keywords de alto riesgo con métricas, y adopción de la taxonomía de grooming LATAM 2024-2026."

## Marco conceptual

El sistema clasifica **conductas de riesgo** descritas en reportes comunitarios, siguiendo la taxonomía regional de grooming LATAM. El producto nunca afirma culpabilidad ni emite juicios de valor sobre personas; el lenguaje público y administrativo es descriptivo y estadístico.

En todos los prompts, documentación, correos e interfaces se usará:
- **NNA** (Niños, Niñas y Adolescentes) como término estándar.
- **MASNNA** (Material de Abuso Sexual contra NNA) en lugar de "pornografía infantil".
- **Conducta de riesgo** o **posible conducta constitutiva de delito** en lugar de afirmaciones de delito.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reducir errores silenciosos en clasificaciones automáticas (Priority: P1)

Como administrador del sistema, quiero que el clasificador IA cometa menos errores en los reportes que se publican como CLASIFICADO sin revisión humana, para que la visibilidad pública y el score de los identificadores no se construyan con datos erróneos.

**Why this priority**: El baseline actual muestra que ~15-16% de los reportes auto-clasificados son incorrectos. Un aumento controlado de la tasa de revisión manual es aceptable si la precisión de lo auto-clasificado sube sustancialmente. El KPI principal es reducir el error silencioso, no solo reducir revisión manual.

**Independent Test**: Se puede validar corriendo un conjunto de textos de prueba con etiquetas conocidas y midiendo `precision_auto_clasificados`: de los casos cuyo estado final fue CLASIFICADO, el porcentaje cuya categoría coincide con la etiqueta dorada. El objetivo es que `error_silencioso = 1 - precision_auto_clasificados` sea menor al 5%.

**Acceptance Scenarios**:

1. **Given** un texto ruidoso como "Pruebas # 100 acoso sexual fotos intimidad, niño noche me¿telfofnoe", **When** el sistema lo clasifica, **Then** debe asignar una categoría de riesgo sexual o solicitud de material en lugar de "OTRO" con baja confianza.
2. **Given** un reporte con múltiples conductas descritas (acoso + solicitud de encuentro), **When** el sistema lo clasifica, **Then** debe reflejar las categorías relevantes ordenadas por relevancia en lugar de forzar una única etiqueta.

---

### User Story 2 - Protección redundante de datos personales de NNA (Priority: P1)

Como responsable de protección de datos, quiero que el sistema detecte datos personales identificables de NNA (nombres propios, colegios, direcciones, teléfonos personales, datos escolares) antes de exponerlos, para cumplir con la normativa de privacidad y proteger la identidad de las víctimas.

**Why this priority**: Un falso negativo en PII expone datos sensibles de un NNA. La detección actual depende de una única pasada del modelo, lo que representa un único punto de fallo inaceptable.

**Independent Test**: Se puede validar con un set de textos sintéticos que contienen y no contienen PII de NNA; el sistema debe anonimizar o marcar correctamente todos los casos positivos.

**Acceptance Scenarios**:

1. **Given** un texto que menciona "mi hijo Juan estudia en el colegio San José", **When** el sistema revisa PII, **Then** debe marcar "Juan" y "colegio San José" como datos sensibles.
2. **Given** un texto que solo contiene el teléfono o nick del agresor, **When** el sistema revisa PII, **Then** no debe marcar ese identificador como dato personal de la víctima.

---

### User Story 3 - El sistema aprende de las correcciones humanas (Priority: P2)

Como administrador que corrige clasificaciones erróneas, quiero que el sistema use esas correcciones para clasificar reportes futuros similares, para que la precisión mejore continuamente con el trabajo de revisión manual.

**Why this priority**: Actualmente las correcciones se almacenan en una tabla de entrenamiento pero nadie las consume. Aprovechar ese conocimiento reduce errores repetidos y aumenta el retorno de inversión del tiempo de revisión.

**Independent Test**: Se puede validar agregando una corrección para un texto determinado y luego clasificando un texto similar; el sistema debe incluir el ejemplo corregido como referencia en la nueva clasificación.

**Acceptance Scenarios**:

1. **Given** que un admin corrigió un reporte de "OFRECIMIENTO_REGALOS" a "SOLICITUD_ENCUENTRO", **When** llega un nuevo reporte con texto similar, **Then** el sistema debe considerar esa corrección al decidir la categoría.
2. **Given** que el sistema evalúa un texto que ya existe en el dataset de correcciones, **When** se usa ese texto como referencia, **Then** debe excluirse a sí mismo para evitar sesgar la métrica.

---

### User Story 4 - Visibilidad y red de seguridad para la cola de revisión (Priority: P2)

Como administrador de la cola de revisión manual, quiero ver métricas de calidad del clasificador y que los casos de alto riesgo se prioricen automáticamente, para enfocar mi atención donde más impacto tiene.

**Why this priority**: Sin métricas no se puede medir la mejora. Sin priorización, casos urgentes pueden perderse entre decenas de reportes pendientes.

**Independent Test**: Se puede validar accediendo al dashboard de estadísticas del admin y verificando que se muestran precision por categoría, tasa de revisión manual y distribución de confianza; también se puede validar que un reporte con keywords críticos aparece primero en la cola.

**Acceptance Scenarios**:

1. **Given** que existen correcciones de admin registradas, **When** se abre el dashboard de estadísticas, **Then** se muestra el porcentaje de clasificaciones confirmadas versus corregidas por categoría, incluyendo `precision_auto_clasificados` y `error_silencioso`.
2. **Given** un reporte marcado como OTRO o en revisión manual que contiene términos críticos como "fotos desnuda" o "quedar en secreto", **When** se lista la cola de revisión, **Then** ese reporte aparece con prioridad alta y sin exponer el texto completo en notificaciones.

### Edge Cases

- ¿Qué ocurre si el modelo de lenguaje local no responde o tarda demasiado? El sistema debe tener un timeout y fallback controlado sin perder el reporte.
- ¿Qué ocurre si un texto no encaja en ninguna categoría pero tampoco contiene riesgo? Debe poder clasificarse como OTRO sin ir a revisión manual obligatoriamente.
- ¿Qué ocurre si una corrección de admin fue hecha sobre un reporte que no pasó por anonimización? Debe auditarse y corregirse antes de alimentar el dataset.
  - **Regla de consumo dura del dataset**: todo consumidor del dataset de entrenamiento (retrieval RAG, exports, listados, embeddings) debe filtrar exclusivamente registros con `textoAnonimizado = true`. Los registros no anonimizados solo son visibles como conteo de pendientes y se reintentan mediante un job de backfill hasta lograr la anonimización.
- ¿Qué ocurre si la anonimización del texto de una corrección falla? El registro se guarda marcado como `textoAnonimizado = false` y se encola un job `dataset-anonimizacion-backfill` que reintenta la anonimización en segundo plano.
- ¿Qué ocurre si no hay ejemplos de correcciones similares? El sistema debe funcionar igual que sin RAG, sin fallar.
- ¿Qué ocurre si el texto describe una conducta nueva no prevista en la taxonomía? Debe poder marcarse como OTRO y enviarse a revisión manual con prioridad si hay indicios de riesgo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema debe usar structured output nativo del modelo local (JSON Schema en el campo `format` de la API de Ollama) para obtener categoría, scores y detección de PII sin depender de parseo manual con expresiones regulares. El pipeline debe tolerar modelos que devuelvan el JSON forzado en el campo `thinking` en lugar de `response`.
- **FR-002**: La detección de PII de NNA debe combinar una capa determinística (patrones y heurísticas) con una capa basada en modelo de lenguaje; si cualquiera detecta PII, el reporte se marca como contenedor de PII. Reglas de negocio: el teléfono/nick/usuario del AGRESOR y el nombre del adulto agresor NO son PII; una categoría sexual requiere que la conducta (pedir/enviar) esté presente en el texto.
- **FR-002b — Regla R3 (las reglas determinísticas nunca reclasifican)**: las capas determinísticas (PII, DOXING, keywords de alto riesgo) **nunca** cambian la categoría asignada por el clasificador LLM. Su único efecto permitido es escalar: marcar `REVISION_MANUAL`, `prioridadAlta`, `keywordsDetectadas` o activar cascada a modelo mayor.
- **FR-003**: El clasificador debe soportar múltiples categorías por reporte, devolviendo una categoría principal y una lista de categorías secundarias ordenadas por score.
- **FR-004**: La confianza en la categoría asignada debe calcularse por acuerdo entre múltiples ejecuciones independientes del modelo (votación), no por el número de confianza que el modelo genera como texto.
- **FR-005**: El sistema debe poder recuperar ejemplos similares de correcciones de administradores y usarlos como contexto en la clasificación de nuevos reportes.
- **FR-006**: Los casos donde la votación no alcanza un umbral de confianza configurable deben poder escalarse a un modelo de lenguaje más grande, también configurable.
- **FR-007**: El sistema debe mantener un diccionario de términos de alto riesgo que marquen prioridad en la cola de revisión cuando el estado sea REVISION_MANUAL o la categoría OTRO, sin cambiar la categoría asignada por el modelo.
- **FR-008**: Debe existir un evaluador automatizado que mida precisión, recall, F1 por categoría, tasa de revisión manual, latencia, `precision_auto_clasificados` y `error_silencioso`, comparando el pipeline actual contra cada versión mejorada.
- **FR-009**: El texto original del reporte nunca debe ser modificado por el sistema; cualquier normalización solo puede usarse como contexto auxiliar.
- **FR-010**: El sistema debe adoptar la taxonomía de grooming LATAM 2024-2026, incluyendo las categorías EXTORSION, CONTENIDO_GENERADO_IA, DIFUSION_NO_CONSENTIDA y DOXING, además de las siete existentes.
- **FR-011**: El clasificador debe inferir si el posible agresor aparenta ser otro adolescente/par del entorno escolar (`posibleAgresorPar`) y mostrarlo en el panel admin.
- **FR-012**: Toda referencia a material de abuso sexual en prompts, UI, correos y documentación debe usar el término MASNNA, y todo referente a menores debe usar NNA.

### Key Entities *(include if feature involves data)*

- **Reporte**: texto del reporte, estado de procesamiento, categoría principal asignada, prioridad de revisión, keywords detectados.
- **ClasificacionIA**: resultado del clasificador, categorías secundarias con scores, votos individuales, información de cascada a modelo grande, posibleAgresorPar.
- **DatasetEntrenamiento**: correcciones de administradores con clasificación correcta, flag de uso para entrenamiento, flag de texto anonimizado.
- **EmbeddingDataset**: embeddings de los registros de entrenamiento para búsqueda por similitud.
- **ParametroSistema**: configuraciones de umbrales, número de votos, modelo de desempate, top-k de RAG.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El `error_silencioso` (1 - `precision_auto_clasificados`) debe ser menor al 5%, manteniendo la tasa de `REVISION_MANUAL` en un nivel operativamente manejable.
- **SC-002**: La tasa de reportes clasificados como OTRO disminuye al menos un 30% respecto al clasificador actual, medida sobre el eval harness.
- **SC-003**: El recall de detección de PII de NNA es igual o superior al 99% en el conjunto de prueba sintético.
- **SC-004**: La exactitud (accuracy) global de la categoría principal es al menos 10 puntos porcentuales superior al baseline del clasificador actual.
- **SC-005**: El tiempo de procesamiento de un reporte no excede 60 segundos en el percentil 95 cuando se ejecuta el pipeline completo con votación y RAG.
- **SC-006**: Al menos el 80% de las correcciones de administradores tienen un embedding generado y están disponibles para recuperación por similitud.
- **SC-007**: Las alertas de revisión manual con prioridad alta nunca incluyen el texto del reporte ni los términos detectados, solo el número de seguimiento y la indicación de prioridad.
- **SC-008**: El eval harness reporta métricas segmentadas entre ejemplos limpios y ejemplos con ruido realista, para detectar degradación en textos de baja calidad.

## Protocolo de evaluación

### Determinismo

Todas las llamadas únicas a Ollama (producción y evals) usan por defecto:

- `temperature = 0`
- `seed = 42`

Se envían en el campo `options` de `/api/generate`. El default está en `src/lib/ai/ollama-client.ts`.

**Excepción deliberada**: F4 (votación / self-consistency) **debe** sobrescribir estas opciones con `temperature > 0` para generar variación entre los 5 votos. Sin diversidad controlada, la votación sería 5 copias idénticas y no mediría nada.

### Interpretación de deltas

Aun con determinismo activo se observa una barra de error de aproximadamente **±0.5 pp** entre runs sobre el fixture de 110 (rango empírico 25.56–26.04% en F2). Por tanto:

- **Deltas < 1 pp** entre fases se consideran **empate técnico**.
- Solo deltas ≥ 1 pp se interpretan como evidencia de mejora o regresión.

Sin este protocolo, comparaciones como 26.7% vs 29.7% (o 25.6% vs 26.0%) pueden ser indistinguibles de ruido.

## Evaluación por fase

### V0 — Sanity check F2 vs F1-I1 determinista

**Objetivo**: verificar que la separación de PII en F2 no degradó la clasificación respecto a F1-I1 ejecutado con determinismo (`temperature=0`, `seed=42`).

**Fixture**: `scripts/eval-fixture.json` (110 ejemplos, 10 por categoría, 50 % ruido).

**Resultados**:

| Métrica | F1-I1 determinista | F2 run 3 | Delta |
|---------|-------------------|----------|-------|
| accuracy | 70.91 % | 68.18 % | −2.73 pp |
| precision_auto_clasificados | 74.44 % | 73.96 % | −0.48 pp |
| error_silencioso | 25.56 % | 26.04 % | +0.48 pp |
| revisión_manual | 10.91 % | 12.73 % | +1.82 pp |

**Veredicto**: **empate técnico**. Aunque los agregados están dentro de ±0.5 pp, las predicciones **no eran idénticas**: 34 casos difirieron en al menos predicted/confianza/estado (4 en categoría predicha, 30 en confianza, 11 en estado). Los errores se compensan a nivel agregado, pero F2 pierde 3 casos DOXING que F1-I1 acertaba y no gana ningún caso nuevo. Esto motivó la guarda de escalamiento DOXING en F3.

### F2 — Separación de clasificación y PII + capa determinística compartida

**Objetivo**: desacoplar clasificación y detección de PII, introducir una capa determinística compartida con DOXING y fusionarla con el LLM.

**Fixture**: `scripts/eval-pii-fixture.json` con ≥20 casos:
- Positivos de PII NNA: nombre propio, colegio/institución, dirección colombiana, teléfono atribuido a NNA, datos escolares (grado/salón).
- Negativos de PII NNA: teléfono/nick del agresor, adulto mencionado sin NNA identificable, contextos familiares sin nombre propio.
- Casos de DOXING que reutilizan patrones de PII + intención de publicar.
- Ejemplos ruidosos con errores ortográficos y puntuación.

**Métricas reportadas**:
- `recallDeterministico` y `recallCombinado` a nivel caso.
- `precisionDeterministico` y `precisionCombinada` a nivel caso.
- `falsosPositivosDeterministico` y `falsosPositivosCombinado` (cantidad absoluta; se aceptan FP controlados en la capa determinística porque el anonimizador los deja intactos).
- `fragmentRecallDeterministico`, `fragmentRecallCombinado`, `fragmentRecallLLM` — recall por fragmento esperado.
- `accuracy` de categoría principal y `recallOTRO` como métrica vigilada.

**Runner**: `scripts/eval-pii.ts` guarda resultados en `eval-results/f2-pii-<timestamp>.json`.

### F3 — Single-label + posibleAgresorPar + guarda de escalamiento DOXING (multi-label diferido a F4)

**Objetivo**: mantener el clasificador single-label que cerró F2 (el que da `error_silencioso` ~25.9 %), agregar el campo `posible_agresor_par`, e implementar la guarda R3 de escalamiento DOXING.

**Re-definición de multi-label para F4**: los scores por categoría saldrán de la distribución de los 5 votos de F4 (por ejemplo, 3/5 EXTORSION = principal con score 0.6; 2/5 SOLICITUD_MATERIAL = secundaria con score 0.4). Se conservan las columnas `categoriasSecundarias` y `votos` (F0.5), la UI de secundarias en el panel admin y la métrica de recall de secundarias, pero su población real comienza en F4. La regla `min_score_categoria` = 0.3 se aplica sobre fracciones de voto.

**Hallazgo clave**: `ornith:9b` no calibra scores multi-label en una sola pasada. El intento F3 de pedir un array `{categoria, score}` generó `error_silencioso` 35.7 % (+9.8 pp vs F2), confusión masiva en fronteras difíciles y aumento de falsos OTRO (ver `eval-results/f3-classifier-1784170501792.json`).

**Schema de salida F3-revert**: `categoria` + `confianza` + `posible_agresor_par: boolean`.

**Guarda DOXING (R3)**:
- Si `detectarDoxing(texto).esDoxing === true` y la categoría principal del LLM no es `DOXING`:
  - No se modifica la categoría principal del LLM.
  - Estado final = `REVISION_MANUAL`.
  - `Reporte.prioridadAlta = true`.
  - `Reporte.keywordsDetectadas` se puebla con fragmentos doxing detectados.

**Fix de normalización de acentos en `detectarDoxing`**: el matching se hace sobre el texto normalizado NFD sin diacríticos (`"compartio" ≡ "compartió"`, `"publico" ≡ "publicó"`, etc.), pero los fragmentos reportados conservan el texto original.

**Métricas reportadas**:
- accuracy, precision_auto_clasificados, error_silencioso, revisión manual (igual que F2).
- recall de OTRO vigilado.
- precisión de la guarda DOXING: cuántos casos activó y cuántos eran verdaderos DOXING.
- tasa de `posibleAgresorPar`.
- segmentación limpio/ruidoso.

**Guarda P4**: si `error_silencioso > 26.9 %` (media F2 25.88 % + 1 pp de empate), frenar y reportar regresión.

**Resultados F3-revert** (run de cierre, `f3-revert-classifier-1784172284063.json`):

| Métrica | Valor |
|---------|-------|
| accuracy | 69.09 % |
| precision_auto_clasificados | 73.68 % |
| error_silencioso | 26.32 % |
| revisión_manual | 10.00 % |
| latencia p50 / p95 | 2.287 ms / 2.350 ms |
| posibleAgresorPar | 9.09 % |

**Veredicto**: **F3 cierra como parcial — completación en F4**. El `error_silencioso` (26.32 %) está dentro del empate técnico de la media F2 (25.88 % ± 1 pp), por lo que la guarda P4 no se activó. La guarda DOXING se disparó en 1 caso de DOXING real con precisión 100 %, validando R3. El campo `posibleAgresorPar` se conserva para F4.

**Runner**: `scripts/eval-classifier-f3.ts` guarda resultados en `eval-results/f3-revert-classifier-<timestamp>.json`.

## F4 — Votación / self-consistency con multi-label derivado (siguiente)

**Objetivo**: ejecutar 5 clasificaciones independientes por reporte con `temperature > 0`, derivar la categoría principal y las secundarias a partir de la distribución de votos, y mantener la cascada al modelo grande cuando el acuerdo sea bajo.

**Puntos de diseño abiertos**:
- Esquema por voto: mismo schema single-label de F3 (`categoria`, `confianza`, `posible_agresor_par`) pero llamado 5 veces con seeds diferentes.
- Agregación: categoría principal = moda de los votos; score = fracción de votos / 5. Solo se reportan secundarias con fracción ≥ `min_score_categoria` (0.3).
- Confianza agregada: se puede promediar las confianzas de los votos ganadores o usar directamente la fracción; la decisión final se toma en F4.
- `posibleAgresorPar`: se decide en F4 si se mantiene como OR de los 5 votos o se relega a voto mayoritario. Criterio: no debe degradar `error_silencioso` respecto a F3-revert.
- Cascada a modelo grande: si la categoría principal tiene menos de 3/5 votos, o si `error_silencioso` estimado en votación supera el umbral, se reenvía a `ornith:35b` con `temperature=0`.
- Determinismo: F4 rompe el determinismo deliberadamente en los 5 votos pequeños; la fase de evaluación deberá reportar varianza entre runs.

**Evaluación F4**:
- Comparar contra F3-revert en `scripts/eval-fixture.json`.
- Métricas obligatorias: accuracy, `precision_auto_clasificados`, `error_silencioso`, tasa de revisión manual, recall de `OTRO`, segmentación limpio/ruidoso, varianza entre 3 runs, métricas de cascada.
- Regla de empate: ±1 pp respecto a F3-revert.
- Freno P4: si `error_silencioso > 26.9 %` (mismo umbral de F3) o si la latencia p95 supera 60 s.

## Issues conocidos y métricas vigiladas

- **Recall de OTRO**: en F1 el recall de la categoría `OTRO` es bajo (~30%). Los textos genéricos o ambiguos tienden a ser clasificados como categorías de riesgo concretas (`EXTORSION`, `DOXING`, `CONTACTO_INSISTENTE`, etc.) en lugar de `OTRO`. Esto afecta el score y la visibilidad pública del identificador reportado, lo cual es la dirección de error más costosa del sistema. No se iterará más el prompt en F1/F2; se abordará con multi-label (F3) y votación/self-consistency (F4), donde los casos ambiguos deberían producir votos dispersos y escalar a revisión manual en lugar de auto-clasificarse.
- **Reporte obligatorio en evals**: cada eval de fase posterior debe incluir recall de `OTRO` como métrica vigilada.

## Assumptions

- El modelo de lenguaje local (Ollama) estará disponible durante el procesamiento, con capacidad para ejecutar las llamadas en paralelo que requiere la votación.
- Las correcciones de administradores reflejan la clasificación correcta y se aplican sobre reportes cuyo texto ha sido anonimizado previamente.
- El hardware disponible permite eventualmente ejecutar un modelo de desempate de 27-32B cuantizado, si el administrador decide habilitarlo.
- Los reportes de prueba para el eval harness son representativos de los textos reales que llegan a producción, incluyendo textos con errores de escritura y jerga de plataformas.
- El pipeline de deduplicación existente por embeddings no será alterado por este rediseño.
