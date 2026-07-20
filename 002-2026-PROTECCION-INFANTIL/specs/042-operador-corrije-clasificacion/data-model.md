# Data Model — Spec 042: Operador corrige la clasificación

## Overview

Este spec no introduce cambios en el modelo de datos de Prisma. Reutiliza entidades existentes y se enfoca en verificar el flujo de corrección y completar la cobertura de tests.

---

## Existing Entities

### `Reporte`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador del reporte. |
| `estado` | Enum `EstadoReporte` | Estado objetivo: `CORREGIDO`. Estados de entrada posibles: `REVISION_MANUAL`, `CLASIFICADO`. |
| `operadorId` | String? | FK al operador asignado. Usado para permisos. |
| `clasificacion` | Relación 1:1 con `ClasificacionIA` | Contiene la categoría original. |

### `ClasificacionIA`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador. |
| `reporteId` | String | FK a `Reporte`. |
| `categoria` | Enum `CategoriaConducta` | Categoría actual (se actualiza al corregir). |
| `confianza` | Float | Se setea a `1.0` al corregir. |
| `correccion` | Relación 1:1 con `CorreccionAdmin` | Registro histórico de la corrección. |

### `CorreccionAdmin`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador. |
| `clasificacionId` | String | FK a `ClasificacionIA`. |
| `categoriaOriginal` | Enum `CategoriaConducta` | Categoría antes de la corrección. |
| `categoriaCorregida` | Enum `CategoriaConducta` | Categoría después de la corrección. |
| `adminId` | String | FK al usuario que corrigió (puede ser OPERADOR). |
| `motivo` | String? | Comentario opcional. |
| `confirmada` | Boolean | `false` para correcciones. |

### `TransicionReporte`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador. |
| `reporteId` | String | FK a `Reporte`. |
| `estadoAnterior` | Enum `EstadoReporte` | Estado antes de la corrección. |
| `estadoNuevo` | Enum `EstadoReporte` | `CORREGIDO`. |
| `responsableTipo` | Enum `ResponsableTransicion` | `OPERADOR` cuando el usuario es operador. |
| `responsableId` | String? | ID del operador. |
| `motivo` | String? | "Caso corregido por operador/admin". |
| `metadatos` | Json? | No se usa para correcciones. |

### `DatasetEntrenamiento` / `EmbeddingDataset`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `texto` | String | Texto anonimizado (o original si falla anonimización). |
| `clasificacionCorrecta` | Enum `CategoriaConducta` | `categoriaCorregida`. |
| `fuente` | String | `"correccion_admin"`. |
| `correccionId` | String | FK a `CorreccionAdmin`. |
| `vector` | Unsupported("vector") | Embedding para RAG. |

---

## Data Flow

1. Operador abre el detalle del reporte asignado.
2. Selecciona nueva categoría y opcionalmente motivo.
3. POST `/api/admin/correcciones` con `reporteId`, `categoriaCorregida`, `comentario`.
4. Endpoint valida rol y asignación.
5. Endpoint crea `CorreccionAdmin`.
6. Endpoint actualiza `ClasificacionIA.categoria` y `confianza = 1.0`.
7. Endpoint registra `TransicionReporte` con `responsableTipo = OPERADOR`.
8. Endpoint actualiza `Reporte.estado = CORREGIDO`.
9. Endpoint crea `DatasetEntrenamiento` y genera embedding (con backfill si falla).
10. Endpoint escribe auditoría `CASO_CORREGIDO`.

---

## Constraints & Notes

- No new Prisma fields.
- No new enums.
- `CorreccionAdmin` permite solo una corrección por clasificación (`clasificacionId` unique).
- El `responsableTipo` para rol OPERADOR es `OPERADOR`; para admin es `ADMIN`.
