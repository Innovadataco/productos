# Data Model — Spec 034

## Cambios en el modelo de datos
No se requieren cambios en el esquema de Prisma ni en migraciones de base de datos.

## Entidades afectadas
- **Usuario**: se usan roles existentes (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`).
- **ParametroSistema**: clave `ui.grupos_categoria` se crea/actualiza dinámicamente mediante UPSERT.
- **AuditLog**: se registra `PARAM_UPDATE` en cada creación/actualización de parámetro.

## Datos estáticos
- `public/geo/world-countries.json` (ya existente) se utiliza para el mapa.

## Notas
- Las migraciones deben ser aditivas y no destructivas. No se generan nuevas migraciones.
- El UPSERT de parámetros se realiza a través del endpoint `PATCH /api/config/parametros/[clave]`.
