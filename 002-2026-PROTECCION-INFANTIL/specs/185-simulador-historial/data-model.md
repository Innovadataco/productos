# Data Model: SPEC-185 — Historial y sugerencias del simulador de abusos

**Status**: PLANEADO

## Entidades existentes reutilizadas

### `SimulacionAbusoRun`

Ya definida en SPEC-184. No sufre cambios de schema; se amplía el uso de campos JSON.

| Campo | Tipo | Uso en SPEC-185 |
|-------|------|-----------------|
| `id` | String @id | Identificador de la corrida |
| `escenario` | String | Clave del escenario |
| `totalReportes` | Int | N total de reportes a enviar |
| `progreso` | Int | Reportes ya procesados |
| `estado` | String | PENDIENTE \| EN_PROGRESO \| COMPLETADA \| CANCELADA \| FALLIDA |
| `configJson` | Json? | `{ n, ipInyectada, identificador, plataforma, usuarioId? }` |
| `resultadosJson` | Json? | `{ totalEnviados, totalBloqueados, totalSpam, latenciaPromedioMs, latenciaP50Ms?, latenciaP95Ms?, detalles?: {status,latencia,motivo?}[] }` |
| `creadoPorId` | String | Admin que lanzó la simulación |
| `creadoEn` | DateTime | Inicio de la corrida |
| `actualizadoEn` | DateTime | Última actualización (también indica fin aproximado cuando estado=COMPLETADA) |

### `RateLimit`

Solo lectura para detectar IPs usadas recientemente.

| Campo | Uso |
|-------|-----|
| `ipHash` | Hash de la IP |
| `scope` | Filtro por scope `report` |
| `ventana` | Timestamp de la ventana fija |
| `contador` / `bloqueos` | Indica actividad reciente |

### `Usuario`

Solo lectura para validar `usuarioId` de prueba.

| Campo | Uso |
|-------|-----|
| `id` | Identificador |
| `rol` | Debe ser `PARENT` |
| `estado` | Debe ser `activo` |

### `ParametroSistema`

Nuevo parámetro sembrado en seed.

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `simulacion.spam.usuario_id` | STRING | `""` | ID de usuario PARENT de prueba para escenario "Denunciante spam". Vacío = manual. |

## No hay migración

Se mantiene el principio de "migración aditiva solo si es necesario". En esta spec no se añaden columnas ni tablas nuevas.
