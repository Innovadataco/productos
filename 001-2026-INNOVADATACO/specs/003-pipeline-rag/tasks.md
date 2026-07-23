# Tasks: Pipeline RAG (chunking, embeddings y búsqueda híbrida)

**Input**: Design documents from `specs/003-pipeline-rag/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (**Aprobada, D-044**),
[research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Estado**: ⏸ **NO IMPLEMENTAR** hasta que ZEUS apruebe el plan (§0.1). Este archivo es el
plan de ejecución; no autoriza a escribir código.

**Rama**: `feature/001-scaffolding` (PRUEBAS). Verificar antes de cada commit; nunca `main`.
**Commit y push en el mismo acto, por ODIN** (Metodología §6, regla 2). Staging explícito por
ruta: prohibido `git add -A`.

---

## ⛔ TRABAJO PESADO — LEER ANTES DE EMPEZAR (ADR_002)

**Solo estas cuatro tareas ejecutan inferencia real. Cada una EXIGE turno aprobado por
Jelkin en su momento; un solo modelo grande a la vez en la MacStudio. NO se corren "de
pasada".**

| Tarea | Qué ejecuta | Turno |
|---|---|---|
| **TP-1** (T041) | Ingesta real de un PDF con `nomic-embed-text` (SC-001, SC-002) | **exige turno** |
| **TP-2** (T042) | Búsqueda semántica real (SC-005, SC-013) | **exige turno** |
| **TP-3** (T043) | Ejecución del backfill sobre el histórico (SC-006, SC-007) | **exige turno** |
| **TP-4** (T044) | Medición de latencia / comparación de modelos (SC-018) | **exige turno** |

**TODO LO DEMÁS (T001–T040, T045–T048) se implementa y verifica SIN turno**, con embeddings
mockeados: chunker, enriquecimiento, resolución de config, SQL, RRF, estados del worker,
suite completa. Ninguna de esas tareas hace red ni ejecuta modelos.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencia)
- Cada tarea lleva su verificación; el baseline del quickstart §0 es el criterio.

---

## Phase 1: Baseline y esquema

- [ ] T001 Reconfirmar baseline (quickstart §0) sobre el código del día (§1.1): `DocumentoChunk`
      vacía con índice btree; `text.includes` presente en `search`; suite **181/27**;
      `tsc --noEmit` limpio. Si algo no coincide, **detenerse y reportar**.
- [ ] T002 [P] Confirmar rama `feature/001-scaffolding` y que el stack responde en 5001.
      **No bajarlo.**
- [ ] T003 Migración `add_rag_pipeline`: añade `embeddingModel` y `enrichConfig` al modelo
      Prisma; en SQL crudo, `contenidoFts tsvector GENERATED` (spanish+unaccent sobre
      `contenido` plano), índice **HNSW `vector_cosine_ops`** (reemplaza el btree), índice
      **GIN** sobre `contenidoFts`, índice `(embeddingModel, enrichConfig)`, y FK a
      `DocumentoOficial` a **`ON DELETE CASCADE`**. → FR-022, FR-027, data-model
- [ ] T004 **Gate esquema** sobre BD **desechable** (no la del CEO, D-039):
      `npx prisma migrate deploy` sin error; `\d "DocumentoChunk"` muestra hnsw, gin, CASCADE
      y ningún btree sobre `embedding`. → SC-010, SC-016

**Commit 1** — migración. Push en el mismo acto.

---

## Phase 2: Piezas puras (US1 + config, sin BD ni red)

- [ ] T005 [P] [US1] `src/lib/chunker.ts`: troceado **estructural** (CONSIDERANDO/RESUELVE/
      ARTÍCULO/numerales), tamaño y solape parámetros; fallback por tamaño respetando
      párrafo/frase; `orden` desde 0 sin huecos. → FR-001, FR-002
- [ ] T006 [P] [US1] `src/lib/chunker.test.ts`: 1800 respetado; solape 200; texto corto → 1
      fragmento; vacío/espacios → 0; estructura normativa cortada por sus marcas; sin partir
      palabras. → FR-001, FR-002, §0.2
- [ ] T007 [P] [US1] `src/lib/enrich.ts`: `construirPrefijo(doc, config)` y
      `textoParaVectorizar(contenido, prefijo)`; **apagado por defecto** (prefijo `""` →
      texto == contenido); huella `enrichConfig` estable; **nunca antepone id/nombre de
      archivo** (corrige la fuga, FR-028). → FR-026, D-031
- [ ] T008 [P] [US1] `src/lib/enrich.test.ts`: default → texto idéntico al contenido (SC-021);
      con campos → prefijo determinista; misma config → misma huella; el id del documento
      **no** aparece en el texto vectorizado. → FR-026, FR-028
- [ ] T009 [US2] `src/lib/ragConfig.ts`: resuelve `embedding_model` desde `ModuleSetting`
      (`base_oficial`) → `AiModel`, con precedencia §0.7 (BD/UI > `OLLAMA_BASEURL` > default);
      expone también los parámetros del RAG (tamaño, solape, top-k, umbral, pesos RRF,
      enriquecimiento) desde configuración. Sin modelo → error explícito y trazable. → FR-004,
      FR-005, FR-006, FR-023, FR-024
- [ ] T010 [US2] `src/lib/ragConfig.test.ts`: precedencia en los tres casos; ausencia de
      `embedding_model` → error, no adivina; parámetros leídos de config, no literales. → FR-006, SC-014
- [ ] T011 **Gate piezas puras**: `npx vitest run src/lib` verde; sin red ni BD.

**Commit 2** — chunker, enrich, ragConfig. Push en el mismo acto.

---

## Phase 3: Cliente de embeddings (US2, fetch mockeado)

- [ ] T012 [US2] `src/lib/modelClients.ts`: `embedText(model, texto)` que llama a
      **`/api/embeddings`** de Ollama con `resolveOllamaBaseUrl`/`parseConfig`; devuelve el
      vector; **valida 768 dims** antes de devolverlo (FR-007). No toca `callModel` ni el
      `slice(0,3000)` de `documentProcessor.ts` (FR-003). → FR-003, FR-005, FR-007
- [ ] T013 [US2] Extender `src/lib/modelClients.test.ts`: `embedText` con `fetch` mockeado
      compone la URL correcta; vector ≠ 768 → error; sin llamadas de red reales. → FR-007, §0.2

**Commit 3** — cliente de embeddings. Push en el mismo acto.

---

## Phase 4: Ingesta en el worker (US3, embeddings mockeados)

- [ ] T014 [US3] `scripts/worker.mjs`: tras el análisis actual, paso de vectorización —
      `ragConfig` → `chunker` → `enrich` → `embedText` por fragmento → **reemplazo consistente**
      de los chunks del documento (borrar previos + crear nuevos) con `embeddingModel` y
      `enrichConfig`. No bloquea la respuesta HTTP (ya es asíncrono). → FR-008, FR-009, FR-026
- [ ] T015 [US3] Reintentos ante fallo transitorio de embeddings (política pg-boss existente);
      agotados → `needs_review` con motivo en auditoría, **sin** perder texto ni metadatos;
      documento sin texto → sin fragmentos, sin error de embeddings. → FR-010, US3-5
- [ ] T016 [US3] Auditoría del paso de vectorización: fragmentos generados, modelo usado,
      latencia, error si lo hubo (FR-025). → FR-025, SC-018
- [ ] T017 [US3] Arnés de prueba del job con embeddings **mockeados** (`scripts/worker.test.mjs`
      o el que defina el arnés existente): un chunk por fragmento con todos los campos;
      reprocesar **no** duplica (idempotente); reintento y `needs_review`; documento sin
      texto → 0 chunks. → FR-008, FR-009, FR-010, SC-003
- [ ] T018 **Gate ingesta**: pruebas del job verdes sin BD ni Ollama.

**Commit 4** — ingesta. Push en el mismo acto.

---

## Phase 5: Búsqueda híbrida (US4, ramas mockeadas)

- [ ] T019 [US4] `src/lib/search/filtros.ts`: construye el `WHERE` de metadatos (`tipo`,
      `entidad`, `sector`, fechas) + `activo = true`, **parametrizado**, aplicado antes de las
      ramas. → FR-014, FR-022, SC-015
- [ ] T020 [US4] `src/lib/search/rrf.ts`: fusión **RRF** de dos rankings con pesos y top-k
      **de configuración**; puro y testeable. → FR-015, FR-024
- [ ] T021 [US4] `src/lib/search/hibrida.ts`: consulta `$queryRaw` **parametrizada** (FR-012)
      con rama FTS (`contenidoFts @@ plainto_tsquery('spanish', unaccent($q))`) y rama
      vectorial (`embedding <=> $vec`, coseno) filtrada por **modelo + enriquecimiento
      vigentes** (FR-021b); colapsa a un documento por fila (FR-014); incluye puntuación.
      Degradación útil si no hay vectores/Ollama: FTS sola responde. → FR-011…FR-015b, FR-021, SC-004
- [ ] T022 [US4] `src/app/api/documents/search/route.ts`: sustituir la puntuación en memoria
      por `hibrida`; el embedding de la consulta vía `embedText`; **eliminar** `text.includes`.
      Mantener `verifyAuth` (spec 005) y el contrato `apiError`. → FR-015b, FR-018, SC-019
- [ ] T023 [P] [US4] `src/lib/search/rrf.test.ts`: distintos pesos → distinto orden; top-k
      recorta; empates estables. → FR-024, SC-014
- [ ] T024 [US4] `src/app/api/documents/search/route.test.ts` extendido: con ramas y embedding
      de query mockeados — filtros respetados, `activo=false` excluido, un documento por fila,
      puntuación presente, solo modelo+enriquecimiento vigentes, sin `err.message`, y 401 sin
      sesión sigue verde (regresión spec 005). → FR-011…FR-015, FR-018, FR-021, SC-004, SC-015, SC-022
- [ ] T025 [US4] **Gate búsqueda**: `grep -c "text.includes" …/search/route.ts` → **0**;
      pruebas verdes sin BD ni Ollama. → SC-019

**Commit 5** — búsqueda híbrida. Push en el mismo acto.

---

## Phase 6: Backfill (US5) — código sin turno; ejecución es TP-3

- [ ] T026 [US5] `scripts/backfill-embeddings.mjs`: recorre documentos con texto y **sin**
      chunks del modelo+enriquecimiento vigentes; vectoriza; idempotente y reanudable; informa
      progreso y resumen (procesados, omitidos, fallidos). → FR-016, SC-006, SC-007
- [ ] T027 [US5] Contador de **pendientes de re-vectorizar** que cubre **las dos causas**
      (cambio de modelo y de enriquecimiento), consultable. → FR-021c, SC-017
- [ ] T028 [US5] Prueba del backfill con embeddings mockeados: procesa solo los que faltan;
      segunda ejecución no cambia el total; reanuda sin repetir. → FR-016, SC-007
- [ ] T029 **Gate backfill (código)**: pruebas verdes sin infraestructura. La **ejecución** es
      T043 (TP-3, turno).

**Commit 6** — backfill (código). Push en el mismo acto.

---

## Phase 7: Configurabilidad, métricas y suite (US6)

- [ ] T030 [US6] Verificar que **todos** los parámetros del RAG salen de configuración
      (§0.7): estrategia, tamaño, solape, top-k, umbral, pesos RRF y enriquecimiento. Ningún
      literal en código; el **solape 200** queda como default declarado **no medido** (D-029).
      → FR-024, SC-020
- [ ] T031 [US6] Métricas de búsqueda y vectorización consultables desde auditoría (latencia,
      modelo, fragmentos, si hubo evidencia). → FR-025, SC-018
- [ ] T032 [US6] **Gate suite**: `npx vitest run` ≥ 181 verde sin BD ni Ollama; ninguna prueba
      hace red ni inferencia; `npx tsc --noEmit` limpio; `npx eslint src/lib src/app/api` → 0
      `no-explicit-any`. → FR-017, FR-018, SC-008, SC-009

**Commit 7** — configurabilidad y métricas. Push en el mismo acto.

---

## Phase 8: Corrección del banco y fe de erratas (US7)

- [ ] T033 [US7] Corregir la **fuga de etiqueta** del banco (FR-028, D-032): en
      `scripts/eval-embeddings/questions.json`, `documentoEsperado` → **id opaco**; el título a
      un campo aparte con calidad realista; en `scripts/eval-embeddings/lib/enrich.mjs`, dejar
      de anteponer `doc.id`. Actualizar `evaluate.mjs`/`sweep.mjs` si dependían del formato.
      → FR-028
- [ ] T034 [US7] Prueba/aserción de que ningún `documentoEsperado` coincide con texto de
      ranking (SC-024). → FR-028, SC-024
- [ ] T035 [US7] **Al CIERRE**, constitución **§3.4**: describir el pipeline **real** en vez
      del diseño previsto; registrar la enmienda en §10 con versión y fecha. → FR-019, SC-011

**Commit 8** — banco corregido y §3.4. Push en el mismo acto.

---

## Phase 9: Cierre sin turno

- [ ] T036 Aislamiento: puertos 5005/5433/5010/5434 sin cambios; `git diff --cached
      --name-only` solo rutas de `001-2026-INNOVADATACO/`. → FR-020, SC-012
- [ ] T037 Revisión de contratos spec 002/005: cero `any` nuevos, cero fugas de `err.message`,
      `verifyAuth` intacto en `search`. → FR-018, SC-009
- [ ] T038 Verificar `slice(0,3000)` de `documentProcessor.ts` **intacto** (FR-003). → FR-003
- [ ] T039 Actualizar `research.md` con lo que quede medido (si se barre el solape) o dejar
      constancia explícita de que sigue sin medirse. → D-029
- [ ] T040 Reporte de una línea a ZEUS; commits scopeados y pusheados.

---

## Phase 10: ⛔ Validación con inferencia real — CADA UNA EXIGE TURNO (ADR_002)

**No ejecutar sin turno aprobado por Jelkin. Avisar y esperar OK. Un solo modelo grande a la
vez en la MacStudio.**

- [ ] T041 **TP-1** — Ingesta real: subir un PDF con texto; `count(*)` de sus chunks > 0
      (SC-001); todos los vectores de 768 (SC-002). ⛔ **turno**
- [ ] T042 **TP-2** — Búsqueda real: consulta sin palabras en común recupera el documento
      (SC-005); identificador entre los 3 primeros por FTS (SC-013). ⛔ **turno**
- [ ] T043 **TP-3** — Backfill: `node scripts/backfill-embeddings.mjs`; documentos con texto y
      0 chunks vigentes = 0 (SC-006); segunda ejecución no cambia el total (SC-007).
      ⛔ **turno** (la tarea más costosa)
- [ ] T044 **TP-4** — Latencia y comparación de modelos; alimenta FR-025/SC-018. ⛔ **turno**

---

## Mapa de cobertura FR / SC → tasks

| Requisito | Tasks |
|---|---|
| FR-001, FR-002 | T005, T006 |
| FR-003 | T012, T038 |
| FR-004…FR-006, FR-023 | T009, T010 |
| FR-007 | T012, T013 |
| FR-008, FR-009 | T014, T017 |
| FR-010 | T015, T017 |
| FR-011…FR-015b | T019–T022, T024, T025 |
| FR-016 | T026, T028 |
| FR-017 | T032 |
| FR-018 | T022, T024, T037 |
| FR-019 | T035 |
| FR-020 | T036 |
| FR-021 (a/b/c) | T014, T021, T024, T027 |
| FR-022 | T003, T004, T019 |
| FR-024 | T009, T020, T023, T030 |
| FR-025 | T016, T031 |
| FR-026 | T007, T008, T014 |
| FR-027 | T003, T021 |
| FR-028 | T033, T034 |
| SC-001, SC-002 | T041 (TP-1) |
| SC-003 | T017 |
| SC-004 | T021, T024 |
| SC-005, SC-013 | T042 (TP-2) |
| SC-006, SC-007 | T028 (mock) · T043 (TP-3, real) |
| SC-008, SC-009 | T032, T037 |
| SC-010, SC-016 | T004 |
| SC-011 | T035 |
| SC-012 | T036 |
| SC-014 | T023, T030 |
| SC-015 | T019, T024 |
| SC-017 | T027 |
| SC-018 | T031, T044 (TP-4) |
| SC-019 | T022, T025 |
| SC-020 | T030 |
| SC-021 | T008 |
| SC-022 | T024 |
| SC-023 | T003, T021 |
| SC-024 | T034 |

## Dependencias

- T001–T002 antes de todo. Baseline que no coincide → detenerse y reportar.
- T003–T004 (esquema) antes de ingesta y búsqueda: los campos y los índices los usan.
- Piezas puras (T005–T011) antes de ingesta (usan chunker/enrich/ragConfig) y búsqueda.
- T012–T013 (embedText) antes de ingesta y del embedding de query en la búsqueda.
- Ingesta (T014–T018) y búsqueda (T019–T025) son independientes entre sí una vez hay esquema
  y piezas puras.
- Backfill (T026–T029) después de la ingesta (comparte la lógica de vectorización).
- **TP-1…TP-4 (T041–T044) al final y solo con turno**; nada del resto los necesita para
  quedar verde con mocks.
- §3.4 (T035) es lo último: describe el pipeline **ya real**.

## Fuera de alcance (NO tocar)

- Generación de respuestas con RAG (esto es recuperación, no generación).
- Reranking con cross-encoder; base vectorial dedicada; cambiar dimensión o proveedor.
- `any` de componentes `.tsx` (D-016); paginación de `documents`/`licitaciones` (§3.3).
- El `slice(0,3000)` de `documentProcessor.ts` (FR-003).
- Cualquier archivo de 002-Protección Infantil o 003-SICOV.
