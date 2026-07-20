# Data Model — Spec 041: Cierre de blindaje + saneamiento

## Overview

Este spec no modifica el modelo de datos de Prisma. Sus cambios son: (1) confirmación de índices nativos de PostgreSQL sobre tablas existentes, y (2) saneamiento del contenido almacenado en campos existentes (`Reporte.processingError`, `TransicionReporte.metadatos`).

---

## Existing Entities (no migration required)

### `Reporte`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador del reporte. |
| `processingError` | String? | **Antes**: mensaje crudo del error de infraestructura/proveedor. **Ahora**: mensaje genérico + código de error. |
| `estado` | Enum | Se actualiza a `REVISION_MANUAL` cuando el pipeline falla. |

### `TransicionReporte`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador de la transición. |
| `reporteId` | String | FK a `Reporte`. |
| `estadoAnterior` | Enum | Estado previo. |
| `estadoNuevo` | Enum | `REVISION_MANUAL` en caso de error. |
| `motivo` | String? | Descripción pública de la transición. |
| `metadatos` | Json? | Ahora incluye `errorCode` en lugar del mensaje crudo. |
| `responsable` | Enum | `SISTEMA` para transiciones automáticas. |

### `EmbeddingReporte`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador del embedding. |
| `vector` | Unsupported("vector") | Vector de embeddings. |
| `reporteId` | String | FK a `Reporte`. |

**Index (verified)**: `EmbeddingReporte_vector_idx` (`USING hnsw` on `vector`).

### `EmbeddingDataset`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador del embedding. |
| `vector` | Unsupported("vector") | Vector de embeddings. |
| `datasetEntrenamientoId` | String | FK a `DatasetEntrenamiento`. |

**Index (verified)**: `EmbeddingDataset_vector_idx` (`USING hnsw` on `vector`).

---

## Data Flow

1. Pipeline fails in `/api/reportes/procesar` or `/api/reportes/fallback`.
2. Endpoint computes `errorCode` (e.g., `OLLAMA_UNAVAILABLE`, `INTERNAL_ERROR`).
3. Endpoint updates `Reporte`:
   - `estado`: `REVISION_MANUAL`
   - `processingError`: `"Error durante el procesamiento del reporte (código: <errorCode>)"`
4. Endpoint creates `TransicionReporte` with `metadatos.errorCode = <errorCode>`.
5. Raw provider/worker message is **not** persisted.

---

## Constraints & Notes

- No new Prisma fields.
- No new enums.
- HNSW indexes are native PostgreSQL indexes, not managed by Prisma schema.
- `verify-hnsw-indexes.ts` queries `pg_indexes` to confirm index type.
