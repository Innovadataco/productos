# Data Model — 080-orden-migraciones-colegio (I-04)

> **Sin cambios de schema ni de datos.** Esta spec solo reordena la aplicación de migraciones.

## Cambio

`git mv prisma/migrations/20260721001700_add_departamento → 20260720210000_add_departamento` (contenido SQL intacto; checksums estables).

## Orden resultante (cadena relevante)

```text
20260714105800_add_pais_ciudad        → crea Pais, Ciudad
20260720174150_add_simulacion_tables
20260720210000_add_departamento       → crea Departamento + Ciudad.departamentoId  (movida)
20260720214140_add_colegio            → crea Colegio + FK Colegio.departamentoId
20260721060000_add_colegio_cursos_alumnos
```

## Invariantes

- Esquema final idéntico (mismas tablas/columnas/índices/FKs; verificado con `migrate dev` sin drift atribuible).
- `_prisma_migrations` en BD frescas registra el nombre nuevo; BD de desarrollo preexistentes se realinean con `migrate reset --force` (fase DESARROLLO, dataset regenerable).
- Drift preexistente no relacionado: índices HNSW `EmbeddingDataset_vector_idx` / `EmbeddingReporte_vector_idx` (creados por SQL crudo, no expresables en schema.prisma) — documentado como deuda, NO aplicar el DROP propuesto por Prisma.
