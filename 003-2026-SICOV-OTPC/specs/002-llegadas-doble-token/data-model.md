# Data Model — 002-llegadas-doble-token

> Columnas **verificadas 1:1** contra `legacy-sistema-original/back_gestion_despachos/database/migrations/1766100000001_tbl_llegadas_solicitudes.ts`. A diferencia de despachos, **la tabla legacy de llegadas NO tiene columnas de cola** (no hay ALTER equivalente); el 003 las añade **aditivamente**.

## LlegadaSolicitud → `sicov.tbl_llegadas_solicitudes`

### Columnas base (existen en el legacy — verificadas)
| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `lle_sol_id` | Int PK serial | no | auto |
| `payload` | `lle_sol_payload` | Json | **no** | — |
| `nitVigilado` | `lle_sol_nit_vigilado` | varchar(20) | **no** | — |
| `usuarioId` | `lle_sol_usuario_id` | varchar(20) | **no** | — |
| `fuente` | `lle_sol_fuente` | varchar(10) | **no** | 'WEB' |
| `tipoLlegada` | `lle_sol_tipo_llegada` | Int | **no** | — |
| `idDespacho` | `lle_sol_id_despacho` | Int | sí | — (referencia lógica, sin FK) |
| `placa` | `lle_sol_placa` | varchar(10) | **no** | — |
| `procesado` | `lle_sol_procesado` | Boolean | **no** | false |
| `idLlegadaExterno` | `lle_sol_id_llegada_externo` | Int | sí | — |
| `respuestaExterna` | `lle_sol_respuesta_externa` | Json | sí | — |
| `errorExterno` | `lle_sol_error_externo` | Text | sí | — |
| `fechaCreacion` | `lle_sol_fecha_creacion` | Timestamptz | sí | now() |
| `fechaActualizacion` | `lle_sol_fecha_actualizacion` | Timestamptz | sí | now() |

### Columnas de cola — **añadidas por el 003 (migración ADITIVA)**
Espejo del alter de despachos (`des_sol_*`). El legacy de llegadas no las tiene; se agregan para el worker table-driven.
| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `estado` | `lle_sol_estado` | varchar(30) | **no** | 'pendiente' |
| `reintentos` | `lle_sol_reintentos` | Int | **no** | 0 |
| `rolId` | `lle_sol_rol_id` | Int | sí | — |
| `siguienteIntento` | `lle_sol_siguiente_intento` | Timestamptz | sí | now() |

Índice: `@@index([estado, siguienteIntento], map: "lle_sol_estado_intento_idx")`, `@@index([nitVigilado])`.

**Ciclo de vida:** idéntico a despachos — `pendiente → procesando → procesado` | `fallido` (reintentable). `usuarioId`/`nitVigilado`/`rolId` guardan el contexto efectivo (heredado si rol 3). `estado='fallido'` reintentable manual reinicia `reintentos=0`.

## Modelo Prisma (a agregar en `schema.prisma`)
```prisma
model LlegadaSolicitud {
  id                Int       @id @default(autoincrement()) @map("lle_sol_id")
  payload           Json      @map("lle_sol_payload") @db.Json
  nitVigilado       String    @map("lle_sol_nit_vigilado") @db.VarChar(20)
  usuarioId         String    @map("lle_sol_usuario_id") @db.VarChar(20)
  fuente            String    @default("WEB") @map("lle_sol_fuente") @db.VarChar(10)
  tipoLlegada       Int       @map("lle_sol_tipo_llegada")
  idDespacho        Int?      @map("lle_sol_id_despacho")
  placa             String    @map("lle_sol_placa") @db.VarChar(10)
  procesado         Boolean   @default(false) @map("lle_sol_procesado")
  idLlegadaExterno  Int?      @map("lle_sol_id_llegada_externo")
  respuestaExterna  Json?     @map("lle_sol_respuesta_externa") @db.Json
  errorExterno      String?   @map("lle_sol_error_externo") @db.Text
  // --- columnas de cola (añadidas aditivamente por el 003) ---
  estado            String    @default("pendiente") @map("lle_sol_estado") @db.VarChar(30)
  reintentos        Int       @default(0) @map("lle_sol_reintentos")
  rolId             Int?      @map("lle_sol_rol_id")
  siguienteIntento  DateTime? @default(now()) @map("lle_sol_siguiente_intento") @db.Timestamptz()
  fechaCreacion     DateTime? @default(now()) @map("lle_sol_fecha_creacion") @db.Timestamptz()
  fechaActualizacion DateTime? @default(now()) @map("lle_sol_fecha_actualizacion") @db.Timestamptz()

  @@index([estado, siguienteIntento], map: "lle_sol_estado_intento_idx")
  @@index([nitVigilado])
  @@map("tbl_llegadas_solicitudes")
  @@schema("sicov")
}
```

## Migración aditiva
`prisma migrate dev --name add_llegadas_cola` — crea `tbl_llegadas_solicitudes` (si no existe en la BD del 003) con **todas** las columnas (base + cola) en un solo paso. Como el 003 aún no tenía esta tabla, la migración es puramente aditiva (nueva tabla). Si en el futuro la tabla ya existiera con solo las columnas base, el add de las 4 columnas de cola sería igualmente aditivo (con defaults, sin pérdida de datos).

## Seed demo (ampliación)
Agregar al seed: 2-3 `LlegadaSolicitud` de ejemplo (pendiente/procesado/fallido) para el vigilado demo, con `placa` y `tipo_llegada`, opcionalmente ligadas a un `idDespacho` existente.
