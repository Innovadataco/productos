# Data Model — Spec 035: Correcciones del 034 + blindaje crítico

## Cambios en modelo de datos

Este spec no modifica el modelo de datos de Prisma. Los cambios son:

1. **Migración SQL aditiva** para recrear índices HNSW sobre columnas `vector` existentes.
2. **Script de verificación** que comprueba la existencia de los índices en PostgreSQL.

## Modelos afectados

| Modelo | Cambio | Detalle |
|--------|--------|---------|
| `EmbeddingReporte` | Índice HNSW | `CREATE INDEX IF NOT EXISTS "EmbeddingReporte_vector_idx" ON "EmbeddingReporte" USING hnsw (vector vector_cosine_ops);` |
| `EmbeddingDataset` | Índice HNSW | `CREATE INDEX IF NOT EXISTS "EmbeddingDataset_vector_idx" ON "EmbeddingDataset" USING hnsw (vector vector_cosine_ops);` |

## Notas

- Prisma no gestiona índices de tipo `vector`; deben crearse con migraciones SQL manuales.
- La migración debe ser aditiva y no destructiva: usa `CREATE INDEX IF NOT EXISTS` y no `DROP INDEX`.
- No se alteran tablas ni columnas; solo se crean índices si no existen.
- El script de verificación consulta `pg_indexes` para confirmar que los índices son de tipo `hnsw`.
