> DEPENDE DE: SPEC-200 (timezone Bogotá).

# Modelo de datos: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098)

## Modelos nuevos

### `Notificacion`

Cola + auditoría de envíos.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `evento` | `String` | Ej: `suscripcion.por_vencer` |
| `destinatarioUsuarioId` | `String?` | Nullable para envíos a emails sin usuario |
| `destinatarioEmail` | `String` | Snapshot al envío |
| `plantillaClave` | `String` | FK lógica a `NotificacionPlantilla.clave` |
| `canal` | `CanalNotificacion` | `EMAIL` / `IN_APP` |
| `variables` | `Json` | Variables renderizadas |
| `sujetoTipo` | `String?` | `Suscripcion`, `Reporte`, etc. |
| `sujetoId` | `String?` | Trazabilidad |
| `enviarEn` | `DateTime? @db.Timestamptz(6)` | null = ya; con valor = programada |
| `estado` | `EstadoNotificacion` | enum del BRIEF §3 |
| `intentos` | `Int @default(0)` | |
| `ultimoError` | `String?` | |
| `proveedorId` | `String?` | id Resend |
| `sentAt` | `DateTime? @db.Timestamptz(6)` | |
| `deliveredAt` | `DateTime? @db.Timestamptz(6)` | |
| `openedAt` | `DateTime? @db.Timestamptz(6)` | |
| `clickedAt` | `DateTime? @db.Timestamptz(6)` | |
| `bouncedAt` | `DateTime? @db.Timestamptz(6)` | |
| `canceladoEn` | `DateTime? @db.Timestamptz(6)` | |
| `motivoCancelacion` | `String?` | |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |

Índices: `(estado, enviarEn)`, `(destinatarioUsuarioId, createdAt DESC)`, `(evento, createdAt DESC)`.

### `NotificacionPlantilla`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `clave` | `String @unique` | Ej: `suscripcion.por_vencer.email` |
| `canal` | `CanalNotificacion` | |
| `asunto` | `String?` | Solo email |
| `cuerpoMarkdown` | `String` | Markdown + variables `{{}}` |
| `variablesSchema` | `Json` | JSON Schema de variables |
| `version` | `Int @default(1)` | Incrementa al editar |
| `activa` | `Boolean @default(true)` | |
| `creadaPor` | `String?` | userId |
| `actualizadaPor` | `String?` | userId |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

### `NotificacionRegla`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `evento` | `String` | Evento de dominio |
| `rol` | `String` | Rol destinatario |
| `offset` | `String` | ISO8601 duration signed (`-5d`, `+2d`) |
| `canal` | `CanalNotificacion` | |
| `plantillaClave` | `String` | FK a plantilla |
| `obligatoria` | `Boolean @default(false)` | true = transaccional |
| `activa` | `Boolean @default(true)` | |
| `creadaPor` | `String?` | |
| `actualizadaPor` | `String?` | |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

Índice: `(evento, activa)`.

### `NotificacionPreferencia`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `usuarioId` | `String` | |
| `eventoRegla` | `String` | `"evento.canal"` |
| `habilitado` | `Boolean @default(true)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

`@@unique([usuarioId, eventoRegla])`.

### `NotificacionContactoBloqueado`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `email` | `String @unique` | |
| `bounceCount` | `Int @default(1)` | |
| `ultimoBounce` | `DateTime @db.Timestamptz(6)` | |
| `motivo` | `String` | |
| `bloqueadoEn` | `DateTime @db.Timestamptz(6)` | |
| `notificadoAdminEn` | `DateTime? @db.Timestamptz(6)` | |

## Enums

```prisma
enum CanalNotificacion { EMAIL IN_APP }
enum EstadoNotificacion { ENCOLADA ENVIANDO ENVIADA ABIERTA CLICADA FALLIDA REINTENTANDO CANCELADA }
```

## Semilla

Ver `plan.md` §2.1 y BRIEF §6 / §5.6.
