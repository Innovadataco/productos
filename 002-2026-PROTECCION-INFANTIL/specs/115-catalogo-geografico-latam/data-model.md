# Data Model — SPEC-115: Catálogo geográfico real LATAM

**Migración**: `YYYYMMDDHHMMSS_catalogo_geografico_latam` — **100% aditiva**. Ninguna
columna, índice o fila existente se elimina o modifica de tipo.

## Cambios de schema (`prisma/schema.prisma`)

### `Ciudad` (extiende)

| Campo | Tipo | Notas |
|-------|------|-------|
| `geonameId` | `Int? @unique` | Clave estable del UPSERT GeoNames. NULL en filas legado que no casan. |
| `nombreNormalizado` | `String @default("")` | NFD sin diacríticos + minúsculas (`src/lib/normalizar.ts`). Backfill: el importador lo rellena en TODAS las filas (también legado). |
| `poblacion` | `Int?` | Población GeoNames; ordena resultados de búsqueda. |

Índices nuevos (SQL de migración, no expresables en Prisma el GIN):

- `Ciudad_nombreNormalizado_trgm_idx`: GIN (`nombreNormalizado gin_trgm_ops`) — requiere
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (incluida en la imagen `pgvector/pgvector:pg16`).
- `@@index([paisId, nombreNormalizado])` (btree, vía Prisma) — prefijo dentro de país.

Se CONSERVA `@@unique([nombre, paisId])`: cambiarla rompería el seed y 6 archivos de test
(`nombre_paisId`); las colisiones exactas de nombre se deduplican en el importador.

### `Departamento` (sin cambio de schema)

Se reutiliza `codigo String? @unique` (hoy NULL en los 33 de Colombia) para guardar el
código GeoNames `{ISO2}.{admin1}` (p.ej. `CO.05`, `MX.NL`). El importador casa por nombre
normalizado con los existentes de Colombia (solo fija `codigo`) y crea los que falten en
los demás países. Se conserva `@@unique([nombre, paisId])`.

### `Pais` (sin cambio de schema)

Upsert por `codigo` ISO2. Se crea BZ (Belice); DO y demás existentes intactos.

## Diagrama (sin cambios estructurales de relaciones)

```text
Pais 1─n Departamento 1─n Ciudad
Pais 1─n Ciudad
Ciudad 1─n Reporte        (FK intacta; Reporte.ciudad texto no se toca)
Ciudad 1─n Colegio
```

## Reglas de integridad

- `geonameId` único garantiza idempotencia del importador (`ON CONFLICT ("geonameId")`).
- El UPDATE del UPSERT no toca `nombre`/`paisId` → imposible violar `(nombre, paisId)` en
  re-ejecuciones.
- Ciudades sin coordenadas (legado, "otra ciudad", SV con cobertura pobre): válidas,
  visibles como texto, contadas en `sinUbicacion` del dashboard.
- Búsqueda: normalización idéntica en importación, endpoint y tests
  (`src/lib/normalizar.ts` es la única fuente).
