# Usuarios de prueba — Desarrollo local

**Advertencia**: las cuentas de desarrollo son **provisionales y solo para desarrollo**. Deben eliminarse o desactivarse antes de pasar a producción. Están registradas en `docs/PRE-PRODUCCION.md` como ítem de pre-producción.

> **Nota de limpieza (2026-07-21)**: el seed ahora crea **únicamente** el usuario admin. Los usuarios de prueba de otros roles (padre, operador, comité, school-admin) y el colegio de prueba fueron eliminados de la base de datos y del seed. Si se necesitan para desarrollo, crearlos manualmente o mediante un spec puntual; no reactivar en el seed sin revisar `docs/PRE-PRODUCCION.md`.

Se crean automáticamente al ejecutar `npm run db:seed`. El seed es idempotente: si el usuario ya existe, solo actualiza el `passwordHash`, `estado` y `debeCambiarPassword`.

## Credenciales

| Email | Nombre | Rol | Contraseña |
|---|---|---|---|
| `soporte@innovadataco.com` | Administrador | ADMIN | `Admin123!Test` |

## Uso

```bash
npm run db:seed
```

Luego iniciar sesión en `http://localhost:5005/login` con el email y contraseña de la tabla. El usuario tiene `debeCambiarPassword: false`, por lo que entra directamente sin cambio de contraseña forzado.

## Notas de seguridad

- Las contraseñas son débiles y conocidas; nunca usar en producción.
- Antes del despliegue a producción, revisar `docs/PRE-PRODUCCION.md` y ejecutar el spec ~SPEC-090 para cambiar/eliminar este usuario de desarrollo.
