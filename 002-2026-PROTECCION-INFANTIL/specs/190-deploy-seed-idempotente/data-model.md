# Modelo de datos: SPEC-190 — Deploy ejecuta seed idempotente

## Entidades afectadas

- `ParametroSistema` (lectura/escritura vía `prisma.parametroSistema.upsert`).
- `Plataforma`, `Pais`, `Departamento`, `Ciudad` (lectura/escritura vía `upsert`).
- `Usuario` (solo lectura para evitar pisar admin existente).

## Notas

- No hay cambios de schema.
- No hay migraciones.
- El seed usa exclusivamente operaciones idempotentes (`upsert`) y creaciones condicionales.
