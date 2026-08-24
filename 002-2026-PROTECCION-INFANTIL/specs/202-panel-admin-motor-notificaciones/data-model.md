> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Modelo de datos: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099)

## Resumen

No hay cambios de schema. SPEC-202 consume y administra los modelos creados en SPEC-201:

- `Notificacion`
- `NotificacionPlantilla`
- `NotificacionRegla`
- `NotificacionPreferencia`
- `NotificacionContactoBloqueado`

## Uso por funcionalidad

| Funcionalidad | Modelos usados | Operaciones |
|---|---|---|
| Bandeja de notificaciones | `Notificacion` | Listado paginado, filtros, detalle |
| Editor de plantillas | `NotificacionPlantilla` | CRUD + versionado |
| Editor de reglas | `NotificacionRegla` | CRUD + recálculo |
| Parámetros | `ParametroSistema` | Lectura/escritura de claves `notificaciones.*` |
| Salud del motor | `Notificacion`, `NotificacionContactoBloqueado` | Agregaciones, bounces |
| Webhook Resend | `Notificacion`, `NotificacionContactoBloqueado` | Actualización de estados y bounces |

## Notas

- El versionado de plantillas se maneja con el campo `version` del modelo; no hay tabla histórica en v1.
- Los parámetros del motor ya fueron sembrados por SPEC-201; el panel solo los edita.
