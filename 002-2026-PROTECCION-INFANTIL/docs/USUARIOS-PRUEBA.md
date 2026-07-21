# Usuarios de prueba — Desarrollo local

**Advertencia**: estas cuentas son **provisionales y solo para desarrollo**. Deben eliminarse o desactivarse antes de pasar a producción. Están registradas en `docs/PRE-PRODUCCION.md` como ítem de pre-producción.

Se crean automáticamente al ejecutar `npm run db:seed`. El seed es idempotente: si los usuarios ya existen, solo actualiza el `passwordHash`, `estado` y `debeCambiarPassword`.

## Credenciales

| Email | Nombre | Rol | Contraseña |
|---|---|---|---|
| `soporte@innovadataco.com` | Administrador | ADMIN | `Admin123!Test` |
| `carrillo_franco@hotmail.com` | operador1 | OPERADOR | `Operador123!Test` |
| `jelkin.carrillo@gmail.com` | comite | COMITE_VALIDACION | `Comite123!Test` |
| `gerencia@innovadataco.com` | colegio1 | SCHOOL_ADMIN | `Colegio123!Test` |
| `padre@innovadataco.com` | padre | PARENT | `Padre123!Test` |
| `padre1@innovadataco.com` | padre1 | PARENT | `Padre123!Test` |

## Colegio de prueba

El usuario `gerencia@innovadataco.com` (SCHOOL_ADMIN) está vinculado al **Colegio de Pruebas**:

- Ubicación: Medellín, Antioquia, Colombia.
- Dirección: Calle de Prueba 123.
- Vigencia: desde la fecha del seed hasta +1 año (`finServicio` en el futuro).
- Estado: activo.
- Periodo: ANUAL.

## Uso

```bash
npm run db:seed
```

Luego iniciar sesión en `http://localhost:5005/login` con cualquiera de los emails y contraseñas de la tabla. Todos los usuarios tienen `debeCambiarPassword: false`, por lo que entran directamente sin cambio de contraseña forzado.

## Notas de seguridad

- Las contraseñas son débiles y conocidas; nunca usar en producción.
- El `Colegio de Pruebas` y su `Tenant` son datos de desarrollo; no deben migrarse a producción.
- Antes del despliegue a producción, revisar `docs/PRE-PRODUCCION.md` y ejecutar el spec ~SPEC-090 para eliminar o desactivar estos usuarios.
