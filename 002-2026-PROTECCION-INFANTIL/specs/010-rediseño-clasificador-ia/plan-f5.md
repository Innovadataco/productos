# Plan F5 — RAG sobre correcciones para recuperar F4/F5

## Objetivo

Reducir el `error_silencioso` por debajo del piso teórico de F4 (15.5% de casos 5/5 unánimes erróneos) inyectando ejemplos corregidos en el prompt de clasificación. La configuración ganadora del eval A/B (RAG+votos vs RAG+llamada-única) reemplazará a F4 como línea de base estable.

## Condiciones no negociables

### a) Siembra del dataset por fronteras críticas

- Crear **3-5 ejemplos nuevos escritos a mano** por cada una de las 3 fronteras críticas de F4:
  1. `DIFUSION_NO_CONSENTIDA → COMPARTIMIENTO_SEXUAL`
  2. `SOLICITUD_MATERIAL → EXTORSION`
  3. `OTRO → CONTACTO_INSISTENTE`
- Los textos deben ser **distintos** a los 17 casos del fixture F4; **prohibido** copiar o parafrasear esos casos.
- Cada ejemplo se inserta en `DatasetEntrenamiento` con:
  - `texto` (anonimizado manualmente si aplica),
  - `categoriaCorrecta`,
  - `fuente = "siembra"`,
  - embedding precalculado vía `nomic-embed-text`.
- Estos registros son la semilla inicial para retrieval; más adelante se suman correcciones reales del panel admin.

### b) Anti-leakage en modo eval

- En el eval F5, antes de recuperar ejemplos para un caso, se excluye cualquier vecino con similitud coseno **> 0.98** respecto al texto evaluado.
- Esto evita que el fixture se evalúe contra sí mismo.
- Implementar y testear con un caso de prueba que tenga un duplicado exacto en el dataset.

### c) Eval A/B obligatorio

Correr dos configuraciones sobre el fixture de 110 ejemplos:

1. **RAG + votos** (configuración de F4 con umbral 0.8 o la ganadora de T1 si hubiera sido aceptada).
2. **RAG + llamada única** (equivalente a F3-revert, pero con ejemplos inyectados en el prompt).

Reportar por cada brazo:

- `accuracy`, `error_silencioso`, `% REVISION_MANUAL`, `recall OTRO`.
- Cuántos de los **17 casos unánimes erróneos** de F4 son "volteados" a la categoría correcta.
- Tasa de `posibleAgresorPar`.

La configuración con menor `error_silencioso` (sin violar el tope de revisión manual) queda como **línea de base F5**. La otra se documenta en este plan.

### d) Resto del pipeline según el plan original

1. **Tabla `EmbeddingDataset`**
   - Columnas mínimas: `id`, `datasetEntrenamientoId`, `embedding` (vector `pgvector`), `modelo`, `createdAt`.
   - Relación 1:1 con `DatasetEntrenamiento`.
   - Actualizar `prisma/schema.prisma` y generar migración.

2. **Embedding en `src/app/api/admin/correcciones/route.ts`**
   - Después de guardar la corrección, calcular embedding de `texto` (anonimizado).
   - Si el embedding sincrónico falla, **no romper la corrección**: encolar job `embedding-backfill` (reutilizar mecanismo existente de backfill de anonimización).
   - En éxito, escribir fila en `EmbeddingDataset`.

3. **Retrieval en `src/app/api/reportes/procesar/route.ts`**
   - Reutilizar el vector de embedding que ya se calcula para la búsqueda de similitud/detección de duplicados.
   - Recuperar **top-3** ejemplos de `DatasetEntrenamiento` + `EmbeddingDataset` con similitud coseno > umbral mínimo (ej. 0.75).
   - Inyectar ejemplos como contexto few-shot en el prompt de clasificación **solo si hay al menos 1 ejemplo**; si no, prompt original.

4. **Prompt dinámico**
   - Añadir sección `Ejemplos corregidos similares:` con formato `Texto: ...\nCategoría: ...`.
   - Limitar longitud total de contexto para no sobrepasar la ventana de `ornith:9b`.

5. **Eval harness F5**
   - Extender `scripts/eval-classifier-f4.ts` o crear `scripts/eval-classifier-f5.ts`.
   - Soportar ambos brazos A/B por flag.
   - Aplicar anti-leakage por similitud >0.98.
   - Guardar reporte comparativo en `eval-results/`.

## Resultados del eval A/B

Ejecutado: `eval-results/f5-rag-classifier-1784187260732.json`.

| Configuración | `error_silencioso` | `% REVISION_MANUAL` |
|---|---|---|
| RAG + votos (umbral 0.8) | 27.2% | 16.4% |
| RAG + llamada única (umbral 0.5) | 26.3% | 10.0% |
| **RAG + votos (umbral 1.0)** | **21.9%** | **33.6%** |
| RAG + votos (margen ≥2) | 29.0% | 9.1% |

**Ganador:** la **política de agregación `umbral 1.0`** sobre el brazo de votos.

### Efecto honesto del RAG

- El RAG aportó **+1.4 pp** de mejora en `error_silencioso` sobre el brazo votos (de 27.2% con umbral 0.8 a 21.9% con umbral 1.0). El salto principal viene del umbral 1.0, no del RAG en sí.
- El RAG no mostró ganancia en el brazo de llamada única (~0 pp vs F3-revert sin RAG): 26.3% con RAG vs el baseline histórico de 26.3%.
- Solo **1/17** casos unánimes erróneos de F4 fue volteado por el RAG.
- El valor del RAG se espera que escale con correcciones reales. La siembra actual es solo de **15 ejemplos** (5 por frontera crítica).

### Decisión de trade-off (confirmada por owner)

Se acepta `umbral_revision = 1.0` con **33.6% de revisión manual** como configuración **provisional**. El tope orientativo de ~25% de F4 queda superado por decisión explícita de producto: se prioriza `error_silencioso` bajo sobre menor tasa de revisión manual. Esta configuración se revisitará cuando F6 esté medida y cuando haya volumen real de correcciones.

- F5 **recuperado** según criterio P4 (`error_silencioso` ≤ 26.3%).
- Latencia p50/p95 con retrieval: ~6.1s / ~6.4s.
- Anti-leakage: verificado.

## Métricas de seguimiento para F7

Para monitorear la evolución del RAG en producción:

1. **Tamaño del dataset de correcciones:** cantidad de registros en `DatasetEntrenamiento` con `fuente = "correccion_admin"` (y total incluyendo siembra).
2. **Tasa de uso del retrieval:** % de reportes procesados que recuperan al menos 1 ejemplo (`ej > 0`).

## Criterio de éxito F5

- ✅ `error_silencioso` < 26.3% (línea F3-revert), alcanzado 21.9%.
- ✅ `% REVISION_MANUAL` de 33.6% aceptado como trade-off provisional por decisión de producto.
- ⚠️ Al menos 5 de los 17 casos unánimes erróneos de F4 corregidos por el RAG no alcanzado (1/17). El impacto del RAG se dio más en la dispersión de votos de casos no unánimes.
- ✅ Anti-leakage testeado y verde.
- ✅ Correcciones siguen funcionando si el embedding falla (degradación graceful).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El embedding de correcciones falla y la corrección no se guarda | No bloquear la corrección; encolar backfill. |
| RAG empeora fronteras no críticas | Eval A/B lo detecta; quedarse con la base ganadora. |
| Leakage del fixture en eval | Exclusión por similitud >0.98 testeada. |
| Prompt dinámico muy largo | Top-3 + truncado de texto ejemplo. |
| Impacto en latencia | Medir p95 en eval F5; si supera 15s, optimizar retrieval. |

## Archivos esperados a tocar

- `prisma/schema.prisma`
- `src/lib/ai/embedding.ts` (o crear helper de retrieval)
- `src/app/api/admin/correcciones/route.ts`
- `src/app/api/reportes/procesar/route.ts`
- `src/lib/ai/classifier.ts` (prompt dinámico)
- `scripts/eval-classifier-f5.ts`
- `specs/010-rediseño-clasificador-ia/quickstart.md`

## Siguiente paso

Aprobación de este plan antes de implementar la migración de `EmbeddingDataset` y los cambios en el flujo de correcciones.
