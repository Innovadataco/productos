# Data Model — Pipeline RAG

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## `DocumentoChunk` — cambios de esta spec

Hoy (migrada y vacía):

```prisma
model DocumentoChunk {
  id          String   @id @default(cuid())
  documentoId String
  contenido   String
  orden       Int
  embedding   Unsupported("vector(768)")
  createdAt   DateTime @default(now())
  documento   DocumentoOficial @relation(fields: [documentoId], references: [id])
  @@index([documentoId])
  @@index([embedding])   // btree: INÚTIL para similitud, se reemplaza
}
```

### Campos que se añaden

| Campo | Tipo | Nulo | Motivo (FR) |
|---|---|---|---|
| `embeddingModel` | `String` | no | El modelo que generó el vector (FR-021a). Parte de la identidad del espacio vectorial. |
| `enrichConfig` | `String` | no | Huella estable de la configuración de enriquecimiento usada al vectorizar (FR-026). `"none"` cuando el prefijo está apagado (default). |
| `contenidoFts` | `tsvector` **GENERATED** | no | Índice FTS sobre `contenido` **plano**, `spanish` + `unaccent` (FR-027). Generado por la BD, nunca escrito por la app. |

> `embeddingModel` + `enrichConfig` juntos definen **a qué espacio vectorial pertenece el
> fragmento**. La búsqueda filtra por los dos valores vigentes (FR-021b); el contador de
> pendientes de re-vectorizar cuenta los que no coinciden en cualquiera de los dos.

### Restricciones e índices

- **FK** `documentoId → DocumentoOficial.id`: pasa de `RESTRICT` a **`ON DELETE CASCADE`**
  (FR-022, D-021). Baja lógica (`activo=false`) **no** borra chunks; la búsqueda los excluye.
- **HNSW** `USING hnsw (embedding vector_cosine_ops)` — reemplaza el btree (D-020, SC-010/016).
- **GIN** `USING gin (contenidoFts)` (D-019, SC-016).
- `@@index([documentoId])` se conserva.
- Índice compuesto sugerido `(embeddingModel, enrichConfig)` para el filtro de la búsqueda y
  el conteo de pendientes.

`embedding`, `contenidoFts` y los índices HNSW/GIN se declaran en **SQL crudo dentro de la
migración** porque Prisma no los tipa (R-01). El modelo Prisma añade `embeddingModel` y
`enrichConfig` (que sí tipa) y mantiene `embedding` como `Unsupported`.

## `ModuleSetting` — sin cambios de esquema, cambio de **uso**

Ya existe (`@@unique([module, settingKey])`). Esta spec hace que el backend **la lea**
(FR-023), corrigiendo la violación de ADR_004:

| module | settingKey | Apunta a | Lo consume |
|---|---|---|---|
| `base_oficial` | `embedding_model` | `AiModel` | worker (vectorizar) y búsqueda (embedding de query) |
| `base_oficial` | `generation_model` | `AiModel` | worker (análisis; ya existía la intención) |

Parámetros del RAG que **no** son un `AiModel` (tamaño, solape, top-k, umbral, pesos RRF,
enriquecimiento) se persisten también en configuración (FR-024). El plan define el mecanismo
concreto (fila de `ModuleSetting` con valor serializado o tabla de parámetros); la spec solo
exige que **no sean literales en código** y que cambiarlos no requiera recompilar.

## Entidades lógicas nuevas (no son tablas)

- **Fragmento vectorizable**: `{ contenido, orden }` que produce el chunker antes de persistir.
- **Configuración de enriquecimiento**: `{ aplicar: bool, campos: string[] }` → huella
  `enrichConfig`. Default `{ aplicar: false }` → `"none"`.
- **Resultado de búsqueda**: documento (una sola vez, FR-014) + puntuación fusionada RRF +
  procedencia (FTS / vectorial / ambas), para auditoría (FR-025).

## Estados del documento (sin cambios de nombres)

`queued → processing → completed | needs_review | error`. El paso de vectorización se inserta
**dentro** de `processing`: si falla definitivamente, `needs_review` con motivo en auditoría,
**sin** perder texto ni metadatos (FR-010). Documento sin texto extraíble → `completed` sin
fragmentos (US3-5).
