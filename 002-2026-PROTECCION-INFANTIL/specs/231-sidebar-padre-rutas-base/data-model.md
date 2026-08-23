# Modelo de datos — SPEC-231

## Cambio de schema

**Ninguno.** Esta SPEC no modifica `prisma/schema.prisma` ni genera migraciones.

## Catálogo de módulos

No se agregan claves nuevas a `src/lib/permisos-catalogo.ts`. El área del padre no usa permisos granulares por módulo en v1; el sidebar muestra todos los items y el proxy controla el acceso por rol.

## Modelos afectados (solo lectura de contexto)

- `Usuario`: se usa para verificar sesión y rol en el layout.
- `Suscripcion`: existe en BD (SPEC-210) pero esta SPEC no la consulta; el placeholder de suscripción es estático.
- `Expediente` / `EventoExpediente`: existen en BD (SPEC-230) pero esta SPEC no los consulta; el placeholder de expedientes es estático.

## Seed

No requiere seed adicional.
