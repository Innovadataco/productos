# Quickstart — Verificación del pipeline RAG

Comandos de verificación de la spec 003. Todo lo de las secciones 1–5 corre **sin turno y
sin infraestructura** (embeddings mockeados). La sección 6 (TP-1…TP-4) ejecuta **inferencia
real** y **no se corre sin turno aprobado por Jelkin** (ADR_002). Todo desde
`001-2026-INNOVADATACO/`. **El stack del CEO no se baja**; la migración se ensaya en BD
desechable (D-039).

## 0. Baseline

```bash
npx vitest run                       # 181 en 27 archivos (tras spec 005)
npx tsc --noEmit                     # limpio
grep -c "text.includes" src/app/api/documents/search/route.ts   # -> 1 (a eliminar)
# DocumentoChunk vacía y sin índice útil:
#   \d "DocumentoChunk"  -> índice btree sobre embedding; count = 0
```

## 1. Migración (esquema) — BD desechable, no la del CEO

```bash
npx prisma migrate deploy            # aplica campos, HNSW, GIN y CASCADE
# Verif: \d "DocumentoChunk" muestra índice hnsw (vector_cosine_ops) y gin (contenidoFts);
#        la FK a DocumentoOficial es ON DELETE CASCADE; no queda el btree.
```

## 2. Piezas puras (sin BD ni red)

```bash
npx vitest run src/lib/chunker.test.ts src/lib/enrich.test.ts src/lib/ragConfig.test.ts
```

Objetivos:
- **chunker**: estructural corta por CONSIDERANDO/RESUELVE/ARTÍCULO; respeta 1800 y solape
  200; texto corto → 1 fragmento; vacío → 0; `orden` desde 0 sin huecos (FR-001, FR-002).
- **enrich**: con config por defecto el prefijo es `""` y `textoParaVectorizar == contenido`
  (SC-021); nunca antepone el id/nombre de archivo (corrige la fuga, FR-028).
- **ragConfig**: precedencia §0.7 (BD/UI > env > default); sin `embedding_model` → error
  explícito, no adivina (FR-006, FR-023).

## 3. Cliente de embeddings (fetch mockeado)

```bash
npx vitest run src/lib/modelClients.test.ts
```

Objetivos: `embedText` llama a `/api/embeddings` con `resolveOllamaBaseUrl`; **rechaza** un
vector que no mida 768 (FR-007); ninguna prueba hace red.

## 4. Ingesta en el worker (embeddings mockeados)

```bash
npx vitest run scripts/worker.test.mjs   # o el arnés que defina tasks.md
```

Objetivos (FR-008…FR-010): un chunk por fragmento con `contenido`, `orden`, `embedding`,
`embeddingModel`, `enrichConfig`; reprocesar **no** duplica (idempotente); fallo transitorio
reintenta; fallo definitivo → `needs_review` sin perder texto; documento sin texto → sin
fragmentos y sin error de embeddings.

## 5. Búsqueda híbrida (consulta vectorial y embedding de query mockeados)

```bash
npx vitest run src/app/api/documents/search/route.test.ts src/lib/search
grep -c "text.includes" src/app/api/documents/search/route.ts   # -> 0 (FR-015b)
```

Objetivos:
- filtros (`tipo`, `entidad`, `sector`, fechas) aplicados **antes** de ambas ramas; `activo
  = false` excluido (FR-014, SC-015);
- cada documento una sola vez (FR-014); puntuación incluida (SC-004);
- la fusión usa **RRF** con pesos y top-k **de configuración**: cambiarlos altera el orden
  sin recompilar (SC-014);
- solo se usan chunks del **modelo + enriquecimiento vigentes** (FR-021b, SC-022);
- sin `err.message` al cliente (FR-018).

## 6. Validación con inferencia real — ⛔ TRABAJO PESADO, EXIGE TURNO (ADR_002)

**No ejecutar ninguno de estos sin turno aprobado por Jelkin.** Un solo modelo grande a la
vez en la MacStudio; avisar y esperar OK.

- **TP-1** — Ingesta real: subir un PDF con texto y comprobar
  `select count(*) from "DocumentoChunk" where "documentoId"=…` **> 0** (SC-001) y todos los
  vectores de 768 (SC-002).
- **TP-2** — Búsqueda real: una consulta **sin palabras en común** recupera el documento
  (SC-005); una consulta por identificador sale entre los 3 primeros por la rama FTS (SC-013).
- **TP-3** — Backfill: `node scripts/backfill-embeddings.mjs`; al terminar, documentos con
  texto y **cero** chunks vigentes = 0 (SC-006); ejecutarlo dos veces no cambia el total
  (SC-007).
- **TP-4** — Medición de latencia y comparación entre modelos (base de FR-025/SC-018).

## 7. Cierre (sin turno)

```bash
npx vitest run                       # >= 181 verdes, sin BD ni Ollama
npx tsc --noEmit                     # limpio
npx eslint src/lib src/app/api       # 0 no-explicit-any
git diff --cached --name-only        # solo rutas de 001-2026-INNOVADATACO/
```

Al cerrar, actualizar la constitución **§3.4** para describir el pipeline **real** en vez del
diseño previsto y registrar la enmienda en §10 (FR-019).
