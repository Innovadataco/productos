# Implementation Plan: Pipeline RAG (chunking, embeddings y búsqueda híbrida)

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `003-pipeline-rag`) | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/003-pipeline-rag/spec.md` (Status: **Aprobada 2026-07-23, D-044**, por ZEUS
y Jelkin, con las enmiendas D-019…D-023 y D-029…D-032 ya incorporadas)

## Summary

Construir lo que H-05 probó inexistente: trocear el texto extraído (estructural / 1800,
D-029), vectorizarlo con el modelo **configurado** en `ModuleSetting` (no el hardcodeado),
poblar `DocumentoChunk` en la ingesta, y sustituir la puntuación en memoria de
`documents/search` por **búsqueda híbrida** FTS(GIN, español) + vectorial(HNSW, coseno)
fusionada con **RRF**. El texto que se vectoriza se **separa** del que se almacena: el
prefijo de enriquecimiento es configurable y **apagado por defecto** (D-030/D-031), y cada
fragmento registra **modelo + enriquecimiento** para que la búsqueda filtre por ambos y no
mezcle espacios vectoriales (FR-021/FR-026).

**Casi todo se implementa y verifica sin turno** con embeddings mockeados (mismo patrón que
la spec 002). Solo **TP-1…TP-4** ejecutan inferencia real y exigen turno de Jelkin (ADR_002).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22; worker en `.mjs` con `tsx`

**Primary Dependencies**: Next.js 16.2.10, Prisma 5.22.0 (con `$queryRaw` para `vector`),
pg-boss 12, pgvector, Vitest 4.1.9

**Storage**: PostgreSQL 16 + pgvector (puerto host 5435). `DocumentoChunk` migrada y **vacía**;
índice actual sobre `embedding` es **btree** (inútil para similitud), se reemplaza por HNSW.

**Testing**: Vitest en entorno `node`, sin BD ni Ollama. El cliente de embeddings se mockea
igual que `callModel`. Línea base a preservar: **181 pruebas en 27 archivos** (tras spec 005).

**Target Platform**: compose sobre Colima (`http://localhost:5001`); worker en su servicio

**Constraints**: cero `any` nuevos; cero fugas de `err.message`; gate `npx tsc --noEmit`;
todo parámetro del RAG configurable (§0.7); staging explícito por ruta; puertos
5005/5433/5010/5434 intocables; **el `slice(0,3000)` de `documentProcessor.ts` no se toca**
(sirve a la extracción por reglas, FR-003)

**Scale/Scope**: ~2000 documentos objetivo, 678 fragmentos medidos sobre 21; el ranking
**debe** resolverse en Postgres, no en Node (FR-015b). Vectores @2000 docs ≈ 190 MB.

## Constitution Check

*GATE inicial y re-check post-diseño: **PASS**.*

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada (D-044); plan y tasks antes de implementar. |
| §0.2 Pruebas | ✅ Chunker, resolución de config, construcción de SQL, RRF y estados se prueban con mocks; la suite sigue verde sin infraestructura. |
| §0.3 Tipado / errores | ✅ `$queryRaw` **parametrizado** (nunca concatenación, FR-012); errores por `apiError`; cero `any`. |
| §0.4 12-factor | ✅ Modelo, URL y todos los parámetros del RAG por configuración; nada hardcodeado. |
| §0.5 Aislamiento | ✅ Solo `001-`. La validación con inferencia (TP-1…TP-4) espera turno; el resto no ejecuta modelos. |
| §0.6 IA local | ✅ Embeddings vía Ollama local; `resolveOllamaBaseUrl` reutilizado (FR-005). |
| §0.7 Configurabilidad | ✅ Estrategia, tamaño, solape, top-k, umbral, pesos RRF y enriquecimiento en config. **El default de solape queda declarado no medido** (D-029), no se disfraza de justificado. |
| §0.8 Agentes | ✅ No aplica (no se entrena; se configura y se filtra corpus). |

**Sin violaciones que justificar.** Complexity Tracking vacío.

## Decisiones de diseño (detalle en research.md)

### A. Esquema — qué cambia en `DocumentoChunk` (migración de esta spec)

Añadir, sin borrar lo existente:

| Campo | Tipo | Motivo |
|---|---|---|
| `embeddingModel` | `String` | FR-021(a): el modelo que generó el vector |
| `enrichConfig` | `String` | FR-026: la config de enriquecimiento usada (huella, p. ej. `"none"` o un hash de campos) |
| `contenidoFts` | `tsvector` (GENERATED) | FR-027: FTS sobre `contenido` **plano**, en español + unaccent |

Índices: **HNSW `vector_cosine_ops`** sobre `embedding` (reemplaza el btree, D-020) y **GIN**
sobre `contenidoFts` (D-019). FK `→ DocumentoOficial` pasa a **`ON DELETE CASCADE`** (FR-022,
D-021). Como Prisma no soporta `vector` ni `tsvector`, estos van en **SQL crudo dentro de la
migración**; el modelo Prisma marca los campos nuevos que sí puede tipar y deja los otros
como `Unsupported`.

### B. Chunker — `src/lib/chunker.ts` (puro, sin dependencias, testeable)

`trocear(texto, opciones)` → `{ contenido, orden }[]`. Estrategia **estructural** (corta por
CONSIDERANDO / RESUELVE / ARTÍCULO / numerales), tamaño máx **1800**, solape **200**, con
fallback por tamaño respetando párrafo/frase. Los tres son parámetros; sus defaults salen de
configuración (§0.7). Reutiliza la lógica ya escrita y validada en
`scripts/eval-embeddings/lib/` como referencia, pero **el chunker de producción es código
nuevo en `src/lib`** con sus pruebas (no se importa desde `scripts/`).

### C. Enriquecimiento — `src/lib/enrich.ts` (puro)

`construirPrefijo(doc, config)` → string; `textoParaVectorizar(contenido, prefijo)`. **Apagado
por defecto**: con la config por defecto el prefijo es `""` y el texto vectorizado == contenido
(SC-021). La huella de la config (`enrichConfig`) se calcula de forma estable para poder
filtrar por ella. **La fuga de etiqueta (FR-028) se corrige aquí**: la versión de producción
nunca antepone el `id`/nombre de archivo; el banco de evaluación se corrige en paralelo
(tarea propia, sin bloquear el pipeline).

### D. Cliente de embeddings — `src/lib/modelClients.ts` (extensión)

Nueva `embedText(model, texto)` que llama a **`/api/embeddings`** de Ollama (hoy solo existe
`/api/generate`), reutilizando `resolveOllamaBaseUrl` y `parseConfig`. Valida que el vector
mide **768** (FR-007) antes de devolverlo. Mockeable igual que `callModel`.

### E. Resolución de configuración — `src/lib/ragConfig.ts`

Lee de `ModuleSetting` (`base_oficial / embedding_model` → `AiModel`) con la precedencia de
§0.7, corrigiendo la violación viva de ADR_004 (hoy worker usa `aiModel.findFirst({active})`,
FR-023). Un solo punto que resuelve modelo, URL y parámetros del RAG; el worker y la búsqueda
lo consumen. Sin `embedding_model` configurado → falla explícito y trazable (FR-006).

### F. Ingesta — `scripts/worker.mjs` (extensión del job existente)

Tras la extracción/análisis actuales, un paso nuevo: trocear → enriquecer → `embedText` por
fragmento → **borrar los chunks previos del documento y crear los nuevos** en una operación
consistente (FR-009, idempotente). Estados y auditoría coherentes con lo que ya hace
(`process_start`/`process_end` + métricas, FR-025). Reintentos por la política de pg-boss ya
configurada; agotados, `needs_review` sin perder texto (FR-010). Documento sin texto → sin
fragmentos, sin error de embeddings (US3-5).

### G. Búsqueda híbrida — `src/lib/search/` + `documents/search/route.ts`

`documents/search` deja de puntuar en Node. En su lugar, **una consulta SQL** (`$queryRaw`
parametrizado) que:
1. aplica los filtros de metadatos (`tipo`, `entidad`, `sector`, fechas) **antes** de ambas
   ramas y excluye `activo = false` (FR-014, FR-022);
2. rama **FTS**: `contenidoFts @@ plainto_tsquery('spanish', unaccent($query))`, rankeada;
3. rama **vectorial**: `embedding <=> $queryVec` (coseno) sobre los chunks del **modelo +
   enriquecimiento vigentes** (FR-021b), rankeada;
4. **RRF** fusiona ambos rankings con pesos y `top-k` **configurables** (FR-024, SC-014);
5. colapsa a un documento por fila (FR-014) y devuelve la puntuación.

El embedding de la consulta se genera con `embedText` (mockeable). Si no hay vectores o
Ollama no responde, la rama FTS sola sigue respondiendo (US4-4): degradación útil, no error
opaco.

### H. Backfill — `scripts/backfill-embeddings.mjs` (nuevo, TP-3)

Recorre documentos con texto y **sin** chunks del modelo+enriquecimiento vigentes, los
vectoriza, informa progreso y resumen. Idempotente y reanudable (SC-006/007). Es **trabajo
pesado**: no corre sin turno.

## Orden de implementación (todo sin turno salvo la validación real)

1. **Migración** (esquema B): campos, índices HNSW+GIN, CASCADE. Verificable con `migrate
   deploy` sobre BD desechable — **no** contra la del CEO (D-039).
2. **Piezas puras**: `chunker.ts`, `enrich.ts`, `ragConfig.ts` + sus pruebas. Sin BD ni red.
3. **Cliente `embedText`** + validación de dimensión + pruebas con `fetch` mockeado.
4. **Ingesta en el worker** + pruebas del job con embeddings mockeados (estados, idempotencia).
5. **Búsqueda híbrida**: SQL + RRF + ruta, con la consulta vectorial y el embedding de query
   mockeados; pruebas de forma de respuesta, filtros, dedup y `text.includes` eliminado.
6. **Backfill** (código + pruebas con mock); su **ejecución** es TP-3.
7. **Corrección del banco** (FR-028) y **fe de erratas §3.4** al cierre (FR-019).
8. **Validación con inferencia real**: TP-1…TP-4, **cada una con turno**.

## Verificación por requisito (resumen; detalle en quickstart.md)

| FR | Cómo se verifica | Turno |
|---|---|---|
| FR-001 (troceado) | pruebas del chunker; defaults desde config; solape declarado no medido | no |
| FR-004…FR-006, FR-023 | pruebas de `ragConfig`: precedencia §0.7, fallo explícito sin modelo | no |
| FR-007 | `embedText` rechaza vector ≠ 768 | no |
| FR-008…FR-010 (ingesta) | pruebas del job con mock: chunks creados, idempotencia, reintentos, estados | no |
| FR-011…FR-015b (búsqueda) | pruebas de SQL construido y RRF con ramas mockeadas; `grep text.includes` = 0 | no |
| FR-021/FR-026/FR-027 | fragmentos registran modelo+enriquecimiento; FTS sobre contenido plano; filtro por ambos | no |
| FR-024, SC-014 | cambiar pesos/top-k en config altera el orden sin recompilar | no |
| SC-001…SC-002, SC-005 | conteo real de chunks y recuperación semántica | **TP-1/TP-2** |
| SC-006/SC-007 | backfill deja 0 documentos sin chunks; idempotente | **TP-3** |
| §3.4 constitución | fe de erratas al cierre (FR-019) | no |

## Riesgos

- **R-01 · Prisma y `vector`/`tsvector`.** El cliente no los tipa. Mitigación: toda su
  lectura/escritura por `$queryRaw` **parametrizado** (FR-012); el modelo Prisma solo declara
  los campos tipables. Riesgo de inyección descartado por parametrización.
- **R-02 · La migración corre sobre la BD del CEO.** Es aditiva salvo el reemplazo del índice.
  Se ensaya en BD desechable (D-039); en la viva se aplica con `migrate deploy` sin bajar el
  stack. El índice HNSW sobre tabla **vacía** es instantáneo.
- **R-03 · Recuperar el embedding de la consulta añade latencia.** Es una llamada a Ollama por
  búsqueda. Mitigación: la rama FTS responde aunque la vectorial falle; el top-k y el timeout
  son configurables.
- **R-04 · Sin turno no se puede probar la calidad real.** Aceptado: TP-1…TP-4 quedan
  separados y marcados; la corrección funcional (estados, forma, idempotencia) se prueba con
  mocks y **no** espera turno.
- **R-05 · Mezclar espacios vectoriales.** Es justo lo que FR-021/FR-026 previenen: sin el
  registro de modelo+enriquecimiento por fragmento, un backfill a medias mezcla en silencio.
  El filtro de la búsqueda por ambos es la salvaguarda, y se prueba con mocks.
