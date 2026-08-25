# Contrato de comportamiento: guarda de vigencia

## Alcance

La guarda de vigencia aplica ÚNICAMENTE a:

- `/dashboard/padre/**` para usuarios con rol `PARENT`.
- `/dashboard/colegio/**` para usuarios con rol `SCHOOL_ADMIN` o `COMITE_CONVIVENCIA`.

No aplica a roles internos (`ADMIN`, `OPERADOR`, `COMITE_VALIDACION`) ni a
rutas públicas (`/`, `/login`, `/registro`, `/consulta`, `/reportar`, etc.).

## Fuente de verdad

`Suscripcion.estado` es la única fuente de verdad. El helper no recalcula el
estado a partir de `fechaFin`; solo lo consume. El worker de SPEC-213 se
encarga de mantener `estado` actualizado.

## Matriz de decisión por estado

| Estado                 | Acción en dashboard                         | Banner | Redirección |
|------------------------|---------------------------------------------|--------|-------------|
| `ACTIVA`               | Permitir                                    | No     | No          |
| `EN_GRACIA`            | Permitir                                    | Sí     | No          |
| `SUSPENDIDA`           | Bloquear (redirigir)                        | No     | `/suscripcion` |
| `CANCELADA`            | Bloquear (redirigir)                        | No     | `/suscripcion` |
| `PENDIENTE_AUTORIZACION`| Bloquear (redirigir)                       | No     | `/suscripcion` |
| Sin suscripción        | Bloquear (redirigir)                        | No     | `/suscripcion` |

## Rutas exentas

Nunca se bloquean por vigencia:

- `/consentimiento` (encadenamiento SPEC-241).
- `/dashboard/<rol>/perfil`.
- `/dashboard/<rol>/suscripcion`.
- `/reportar` (solo para rol `PARENT`; excepción social crítica).

## Auditoría

Cada acceso de un padre autenticado a `/reportar` sin suscripción en estado
`ACTIVA` o `EN_GRACIA` genera un `AuditLog`:

- `accion`: `REPORTE_SIN_SUSCRIPCION`
- `tipoRecurso`: `reporte`
- `usuarioId`: id del padre
- `metadatos`: `{ estadoSuscripcion: <estado>, ruta: "/reportar" }`
- `ipAddress` y `userAgent`: extraídos de headers (ofuscados por `logAudit`).

## Timezone

Todas las comparaciones de vigencia usan `America/Bogota` vía `date-fns-tz`.
El helper expone `ahoraBogota()` como punto único de obtención de la hora de
referencia.
