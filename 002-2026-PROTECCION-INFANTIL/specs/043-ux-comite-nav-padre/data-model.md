# Data Model — Spec 043: UX del comité y navegación del padre

## Overview

Este spec es puramente de UX/UI y no introduce cambios en el modelo de datos de Prisma. Reutiliza entidades y endpoints existentes, ajustando únicamente flujos de navegación, presentación y copy.

---

## Existing Entities (no migration required)

### `Usuario`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador del usuario. |
| `rol` | Enum `RolUsuario` | Determina qué enlaces de navegación se muestran (`PARENT`, `COMITE_VALIDACION`, etc.). |

### `SolicitudComite`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador de la solicitud. |
| `reporteId` | String | FK a `Reporte`. |
| `comiteId` | String? | Usuario del comité asignado. |
| `estado` | Enum `EstadoSolicitudComite` | `PENDIENTE`, `ASIGNADA`, `RESUELTA`. |
| `motivo` | String | Motivo del escalamiento. |
| `resolucion` | String? | Resolución del comité. |
| `resueltoEn` | DateTime? | Fecha de resolución. |

### `Reporte`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `id` | String (CUID) | Identificador del reporte. |
| `estado` | Enum `EstadoReporte` | Después de la resolución del comité, siempre será `CORREGIDO`. |
| `clasificacion` | Relación 1:1 con `ClasificacionIA` | Se actualiza con la categoría final elegida por el comité. |

### `ClasificacionIA`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `reporteId` | String | FK a `Reporte`. |
| `categoria` | Enum `CategoriaConducta` | Categoría final (puede ser igual o distinta a la original). |
| `confianza` | Float | Se setea a `1.0` tras la resolución humana. |

### `TransicionReporte`

| Field | Type | Usage in this spec |
|-------|------|--------------------|
| `reporteId` | String | FK a `Reporte`. |
| `estadoAnterior` | Enum `EstadoReporte` | Estado previo del reporte. |
| `estadoNuevo` | Enum `EstadoReporte` | Siempre `CORREGIDO` tras resolución del comité. |
| `responsableTipo` | Enum `ResponsableTransicion` | `COMITE`. |
| `responsableId` | String? | ID del comité. |
| `motivo` | String? | Resolución opcional. |

---

## Data Flow

### Flujo padre autenticado

1. Usuario `PARENT` inicia sesión.
2. `NavHeader` detecta el rol y muestra el enlace a `/dashboard` en el header y menú desplegable.
3. El usuario accede a `/dashboard` y ve "Mis reportes" + "Consulta enriquecida".

### Flujo comité con bandeja unificada

1. Comité logueado entra a `/dashboard/admin/comite`.
2. `ComiteBandeja` carga una sola lista de `SolicitudComite` (pendientes, asignadas, resueltas).
3. El comité hace clic en "Ver detalle" de una solicitud `PENDIENTE`.
4. El frontend llama a `/api/admin/comite/${id}/asignar` y espera respuesta; la solicitud pasa a `ASIGNADA`.
5. Se abre `ComiteSolicitudDetalle` con el flujo "Resolver".
6. El comité selecciona categoría final, escribe resolución opcional y hace clic en "Resolver".
7. El frontend llama a `/api/admin/comite/${id}/resolver` con `categoria` y `resolucion`.
8. El backend actualiza `ClasificacionIA.categoria` y `confianza = 1.0`, crea registro en `TransicionReporte` con `responsableTipo = COMITE` y `estadoNuevo = CORREGIDO`, y actualiza `Reporte.estado = CORREGIDO`.

### Flujo copy del círculo

1. Usuario `PARENT` accede a `/dashboard/circulo-confianza`.
2. El checkbox de notificaciones muestra el texto claro: "Recibir un aviso por email cuando alguno de los contactos de mi Círculo de Confianza aparezca en un reporte."

---

## Constraints & Notes

- No new Prisma fields.
- No new enums.
- El schema del endpoint `resolver` se simplifica: se elimina `accion`.
- El endpoint `asignar` ya existe y se reutiliza.
- La bandeja unificada puede requerir un nuevo endpoint `GET /api/admin/comite/solicitudes` que devuelva todas las solicitudes (no solo pendientes o mías), o reutilizar los existentes combinando resultados. La decisión se documentará en la implementación.
