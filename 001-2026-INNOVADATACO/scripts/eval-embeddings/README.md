# Banco de evaluación de modelos de embeddings

Compara modelos de embeddings de Ollama sobre un corpus normativo **real**, para
decidir con datos qué modelo y qué dimensión usará el pipeline RAG (spec 003).

No forma parte de la aplicación: es una herramienta de apoyo bajo `scripts/`.

## Qué mide

Para cada modelo, con **el mismo troceado y las mismas preguntas** (si cada modelo
recibiera fragmentos distintos, la comparación mediría el troceado y no el modelo):

| Métrica | Significado |
|---|---|
| `recall@1` | Proporción de preguntas cuyo documento correcto sale **primero** |
| `recall@k` | Proporción en la que aparece entre los `k` primeros (`topK`, por defecto 5) |
| `MRR` | Mean Reciprocal Rank: premia que el correcto esté arriba, no solo que esté |
| `ms/fragmento` | Latencia de indexación por fragmento |
| `ms/consulta` | Latencia de vectorizar una consulta (promedio y máximo) |
| `dimensión` | Tamaño del vector (determina el esquema: hoy `vector(768)`) |
| Disco proyectado | MB de la columna vectorial extrapolados a N documentos |

Además desglosa las métricas **por tipo de consulta** (temática, por identificador y
conceptual), que es donde se ven las diferencias interesantes entre modelos.

## Configuración (ADR_004 / constitución §0.7)

Ningún valor operativo está escrito en el código. Precedencia, de mayor a menor:

1. **Argumentos CLI** — `--corpus-path=…`, `--models=a,b`, `--top-k=5`, `--max-chars=1800`
2. **Variables de entorno** — `EVAL_CORPUS_PATH`, `EVAL_MODELS`, `EVAL_TOP_K`, `OLLAMA_BASEURL`
3. **`config.local.json`** — no versionado; ocupa el lugar que en la aplicación tiene la BD/UI
4. **`config.default.json`** — defaults documentados, versionados

`corpusPath` **no tiene default a propósito**: el corpus es externo al repositorio y
no debe adivinarse. La URL de Ollama sigue la misma precedencia que la aplicación
(D-008): valor explícito > `OLLAMA_BASEURL` > `http://localhost:11434`.

## Uso

```bash
# Mínimo
node scripts/eval-embeddings/evaluate.mjs --corpus-path=/ruta/al/corpus

# Comparando modelos (deben estar en Ollama: ollama pull <modelo>)
node scripts/eval-embeddings/evaluate.mjs \
  --corpus-path=/ruta/al/corpus \
  --models=nomic-embed-text,bge-m3

# Ajustando el troceado sin tocar código
node scripts/eval-embeddings/evaluate.mjs --max-chars=1200 --overlap-chars=150
```

O crea `config.local.json` (ignorado por git):

```json
{
  "corpusPath": "/ruta/al/corpus",
  "models": ["nomic-embed-text", "bge-m3"]
}
```

El reporte queda en `reports/ultima-evaluacion.json`, con el detalle de las preguntas
falladas por cada modelo.

## Corpus

**Solo lectura.** Los PDFs no se copian al repositorio, no se modifican y no se
commitean: se extrae su texto en memoria con `pdftotext -layout` (poppler).

Los documentos **sin capa de texto** (escaneos sin OCR) se detectan y se reportan
aparte en vez de contarse como documentos vacíos. Las preguntas cuyo documento
esperado no tiene texto se descartan automáticamente de la evaluación, para no
penalizar a los modelos por algo que no depende de ellos.

## Banco de preguntas

`questions.json` — **borrador pendiente de validación de Jelkin**. Cada pregunta está
anclada a contenido verificado del documento esperado (el campo `anclaje` cita el
fragmento real que la sustenta), y mezcla los tres tipos de consulta que usará el
negocio: temática, por identificador y conceptual.

## Requisitos

- `pdftotext` (poppler): `brew install poppler`
- Ollama corriendo con los modelos a evaluar descargados
- Node >= 22

## Límites deliberados

- Solo modelos de **embeddings**; este banco nunca invoca modelos generativos (ADR_002).
- Mide **recuperación**, no calidad de respuesta generada.
- El ranking de documentos usa max-pooling sobre sus fragmentos (un documento aparece
  una sola vez), igual que hará la búsqueda real (FR-014 de la spec 003).
- La similitud se calcula con **coseno**, la misma métrica que usará la aplicación
  (`vector_cosine_ops`, decisión D-020).
