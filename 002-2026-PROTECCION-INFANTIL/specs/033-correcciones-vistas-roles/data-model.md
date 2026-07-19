# Data Model — Spec 033

## Cambios en el modelo de datos
No se requieren cambios en el esquema de Prisma ni en migraciones de base de datos.

## Entidades afectadas
- **Usuario**: se usa el rol existente `COMITE_VALIDACION` (ya definido en el enum `RolUsuario`).
- **ParametroSistema**: clave `ui.grupos_categoria` (ya existe); se usa para persistir la definición de grupos.
- **Reporte / Ciudad / Pais**: se utilizan los campos y relaciones existentes para agregar reportes por país y ciudad.

## Datos estáticos
- Se añade el archivo `public/geo/world-countries.json` con geometrías de países. No es parte del modelo relacional, sino un recurso estático empaquetado en la aplicación.

## Notas
- Las migraciones deben ser aditivas y no destructivas. Como no hay cambios de modelo, no se generan nuevas migraciones.
