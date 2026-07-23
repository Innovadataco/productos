# Data Model — 005-mantenimientos

> Columnas **verificadas 1:1** contra las migraciones del legacy
> (`legacy-sistema-original/back_gestion_despachos/database/migrations/`):
> `1741737110747_tbl_tipo_mantenimientos`, `1741737350746_tbl_archivo_programas`,
> `1741738067090_tbl_mantenimientos`, `1741738351341_tbl_preventivos`,
> `1741741509196_tbl_correctivos`, `1765560000000_tbl_mantenimiento_jobs` y el ALTER
> `20251226230000_alter_nit_columns_bigint` (`tpv_nit`/`tcv_nit` → bigint).
> Migración del 003: **ADITIVA** (`add_mantenimientos`, crea 6 tablas nuevas en `sicov`). Nunca reset.

## Desviaciones deliberadas vs legacy (documentadas)

| Punto | Legacy | 003 | Motivo |
|---|---|---|---|
| `tmj_tipo` | columna texto + CHECK (enum Adonis) | `varchar(20)` validado en app | Prisma no replica el CHECK de Adonis; valores `base\|preventivo\|correctivo\|alistamiento\|autorizacion` (005 solo procesa los 3 primeros) |
| `tpv_hora` / `tcv_hora` | **`time`** (`table.time()`, `1741738351341_tbl_preventivos.ts:11`) | `varchar(8)` (`HH:mm`) | **DESVIACIÓN aprobada D-022 #3**: Prisma sin tipo Time limpio; hora de pared sin zona; viaja como texto a la Super. **Condición:** validación `^([01]\d|2[0-3]):[0-5]\d$` en el borde (API + XLSX/CSV) |
| FKs de mantenimiento | sin FK física (referencias lógicas) | igual (sin FK) | Paridad; se valida en app |
| id externo del detalle | **sobrescribe** `*_mantenimiento_id` con el id externo, perdiendo el enlace local (`RepositorioMantenimientoDB.ts:1443`) | columnas ADITIVAS **`tpv_mantenimiento_id_externo`** / **`tcv_mantenimiento_id_externo`**; el enlace local NUNCA se toca | **Gate B1 (D-022):** a la Super viaja el id externo, pero local y externo van en columnas separadas |
| `tmt_usuario_id` | `integer` | **BigInt** | Guarda un **NIT** (no un usn_id); un NIT no cabe seguro en Int de 32 bits (menor del gate) |

## TipoMantenimiento → `sicov.tbl_tipo_mantenimientos`

| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `ttm_id` | Int PK serial | no | auto |
| `nombre` | `ttm_nombre` | varchar(150) | sí | — |
| `estado` | `ttm_estado` | Boolean | sí | true |
| `creado` | `ttm_creado` | Timestamptz | sí | now() |
| `actualizado` | `ttm_actualizado` | Timestamptz | sí | now() |

Seed: `1=Preventivo, 2=Correctivo, 3=Alistamiento, 4=Autorización` (005 opera 1-2).

## ArchivoPrograma → `sicov.tbl_archivo_programas`

| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `tap_id` | Int PK serial | no | auto |
| `nombreOriginal` | `tap_nombre_original` | varchar(200) | sí | — |
| `documento` | `tap_documento` | varchar(200) | sí | — (nombre físico del archivo) |
| `ruta` | `tap_ruta` | varchar(200) | sí | — (ruta relativa bajo `UPLOADS_DIR`) |
| `tipoId` | `tap_tipo_id` | Int → `ttm_id` (FK real en legacy) | sí | — |
| `usuarioId` | `tap_usuario_id` | Int | sí | — (id del usuario/vigilado dueño) |
| `estado` | `tap_estado` | Boolean | sí | true |
| `creado` | `tap_creado` | Timestamptz | sí | now() |
| `actualizado` | `tap_actualizado` | Timestamptz | sí | now() |

> Única tabla del grupo con FK física en el legacy (`tap_tipo_id → ttm_id`, cascade). Se replica la FK.

## Mantenimiento (base) → `sicov.tbl_mantenimientos`

| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `tmt_id` | Int PK serial | no | auto |
| `placa` | `tmt_placa` | varchar(6) | sí | — |
| `fechaDiligenciamiento` | `tmt_fecha_diligenciamiento` | Timestamptz | sí | — |
| `tipoId` | `tmt_tipo_id` | Int | sí | — (1-4, sin FK) |
| `usuarioId` | `tmt_usuario_id` | **BigInt** | sí | — (**NIT del vigilado**, no usn_id — así lo usa el legacy; BigInt por ser NIT) |
| `estado` | `tmt_estado` | Boolean | sí | true (false = desactivado por registro más nuevo) |
| `procesado` | `tmt_procesado` | Boolean | sí | false |
| `mantenimientoIdExterno` | `tmt_mantenimiento_id` | Int | sí | — (**id EXTERNO** devuelto por la Super) |
| `creado` | `tmt_creado` | Timestamptz | sí | now() |
| `actualizado` | `tmt_actualizado` | Timestamptz | sí | now() |

Índices 003 (aditivos, no existen en legacy): `@@index([usuarioId, placa, tipoId])`, `@@index([procesado])`.

**Regla de vigencia:** al crear un base tipo 1|2, `UPDATE ... SET tmt_estado=false` para el mismo
`usuarioId+placa+tipoId` previo (paridad `guardarMantenimiento`).

## Preventivo → `sicov.tbl_preventivos` · Correctivo → `sicov.tbl_correctivos`

Idénticas salvo prefijo (`tpv_` / `tcv_`):

| Prisma | Columna | Tipo | Null |
|---|---|---|---|
| `id` | `tpv_id` / `tcv_id` | Int PK serial | no |
| `placa` | `*_placa` | varchar(6) | sí |
| `fecha` | `*_fecha` | date | sí |
| `hora` | `*_hora` | varchar(8) (`HH:mm`; legacy `time`, ver desviaciones) | sí |
| `nit` | `*_nit` | **BigInt** (ALTER verificado) | sí |
| `razonSocial` | `*_razon_social` | varchar(200) | sí |
| `tipoIdentificacion` | `*_tipo_identificacion` | Int | sí |
| `numeroIdentificacion` | `*_numero_identificacion` | varchar(255) | sí |
| `nombresResponsable` | `*_nombres_responsable` | varchar(255) / varchar(200) en tcv | sí |
| `mantenimientoId` | `*_mantenimiento_id` | Int | sí | (**enlace LOCAL al base `tmt_id` — NUNCA se sobrescribe**; el legacy lo pierde al guardar encima el id externo, bug B1) |
| `mantenimientoIdExterno` | `*_mantenimiento_id_externo` | Int | sí | (**columna ADITIVA 003** — id devuelto por la Super) |
| `detalleActividades` | `*_detalle_actividades` | text | sí |
| `estado` | `*_estado` | Boolean, default true | sí |
| `procesado` | `*_procesado` | Boolean, default false | sí |
| `creado` / `actualizado` | `*_creado` / `*_actualizado` | Timestamptz, now() | sí |

Índices 003 (aditivos): `@@index([mantenimientoId])`, `@@index([procesado])`.

## MantenimientoJob → `sicov.tbl_mantenimiento_jobs`

| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `tmj_id` | Int PK serial | no | auto |
| `tipo` | `tmj_tipo` | varchar(20) (`base\|preventivo\|correctivo\|alistamiento\|autorizacion`) | **no** | — |
| `mantenimientoLocalId` | `tmj_mantenimiento_local_id` | Int | sí | — (id del base local) |
| `detalleId` | `tmj_detalle_id` | Int | sí | — (id de tpv/tcv) |
| `vigiladoId` | `tmj_vigilado_id` | varchar(30) | **no** | — (NIT) |
| `usuarioDocumento` | `tmj_usuario_documento` | varchar(30) | **no** | — |
| `rolId` | `tmj_rol_id` | Int | **no** | — |
| `estado` | `tmj_estado` | varchar(30) | **no** | 'pendiente' |
| `reintentos` | `tmj_reintentos` | Int | **no** | 0 |
| `ultimoError` | `tmj_ultimo_error` | text | sí | — |
| `siguienteIntento` | `tmj_siguiente_intento` | Timestamptz | sí | now() |
| `payload` | `tmj_payload` | Json | sí | — |
| `creado` | `tmj_creado` | Timestamptz | sí | now() |
| `actualizado` | `tmj_actualizado` | Timestamptz | sí | now() |

Índices: `@@index([estado, siguienteIntento], map: "tmj_estado_intento_idx")` (paridad legacy) +
aditivos 003: `@@index([vigiladoId])`, `@@index([mantenimientoLocalId])`.

**Ciclo de vida del job:** `pendiente → procesando → procesado | fallido`; error → `reintentos+1` y
`siguienteIntento = now + 5 min` hasta 3 → `fallido`. **Dependencia:** detalle con base sin
`tmt_mantenimiento_id` → `pendiente` +5 min SIN incrementar reintentos. **Reintento manual:**
`actualizar`/`reprogramar` → `pendiente`, `reintentos=0`, `ultimoError=null`, intento inmediato
(`reprogramar` responde 409 si ya está al máximo); `marcarProcesado` → `procesado`.

## Modelos Prisma (a agregar en `schema.prisma`)

```prisma
model TipoMantenimiento {
  id          Int       @id @default(autoincrement()) @map("ttm_id")
  nombre      String?   @map("ttm_nombre") @db.VarChar(150)
  estado      Boolean?  @default(true) @map("ttm_estado")
  creado      DateTime? @default(now()) @map("ttm_creado") @db.Timestamptz()
  actualizado DateTime? @default(now()) @map("ttm_actualizado") @db.Timestamptz()

  archivos ArchivoPrograma[]

  @@map("tbl_tipo_mantenimientos")
  @@schema("sicov")
}

model ArchivoPrograma {
  id             Int       @id @default(autoincrement()) @map("tap_id")
  nombreOriginal String?   @map("tap_nombre_original") @db.VarChar(200)
  documento      String?   @map("tap_documento") @db.VarChar(200)
  ruta           String?   @map("tap_ruta") @db.VarChar(200)
  tipoId         Int?      @map("tap_tipo_id")
  usuarioId      Int?      @map("tap_usuario_id")
  estado         Boolean?  @default(true) @map("tap_estado")
  creado         DateTime? @default(now()) @map("tap_creado") @db.Timestamptz()
  actualizado    DateTime? @default(now()) @map("tap_actualizado") @db.Timestamptz()

  tipo TipoMantenimiento? @relation(fields: [tipoId], references: [id], onDelete: Cascade)

  @@index([usuarioId, tipoId])
  @@map("tbl_archivo_programas")
  @@schema("sicov")
}

/// Cabecera base placa+tipo+vigilado. usuarioId guarda el NIT del vigilado (paridad legacy;
/// BigInt por ser NIT). mantenimientoIdExterno = id devuelto por la Super (separado del id local).
model Mantenimiento {
  id                    Int       @id @default(autoincrement()) @map("tmt_id")
  placa                 String?   @map("tmt_placa") @db.VarChar(6)
  fechaDiligenciamiento DateTime? @map("tmt_fecha_diligenciamiento") @db.Timestamptz()
  tipoId                Int?      @map("tmt_tipo_id")
  usuarioId             BigInt?   @map("tmt_usuario_id")
  estado                Boolean?  @default(true) @map("tmt_estado")
  procesado             Boolean?  @default(false) @map("tmt_procesado")
  mantenimientoIdExterno Int?     @map("tmt_mantenimiento_id")
  creado                DateTime? @default(now()) @map("tmt_creado") @db.Timestamptz()
  actualizado           DateTime? @default(now()) @map("tmt_actualizado") @db.Timestamptz()

  @@index([usuarioId, placa, tipoId])
  @@index([procesado])
  @@map("tbl_mantenimientos")
  @@schema("sicov")
}

model Preventivo {
  id                   Int       @id @default(autoincrement()) @map("tpv_id")
  placa                String?   @map("tpv_placa") @db.VarChar(6)
  fecha                DateTime? @map("tpv_fecha") @db.Date
  hora                 String?   @map("tpv_hora") @db.VarChar(8)
  nit                  BigInt?   @map("tpv_nit")
  razonSocial          String?   @map("tpv_razon_social") @db.VarChar(200)
  tipoIdentificacion   Int?      @map("tpv_tipo_identificacion")
  numeroIdentificacion String?   @map("tpv_numero_identificacion") @db.VarChar(255)
  nombresResponsable   String?   @map("tpv_nombres_responsable") @db.VarChar(255)
  mantenimientoId      Int?      @map("tpv_mantenimiento_id")
  // Columna ADITIVA 003 (gate B1): id externo separado; el enlace local nunca se sobrescribe.
  mantenimientoIdExterno Int?    @map("tpv_mantenimiento_id_externo")
  detalleActividades   String?   @map("tpv_detalle_actividades") @db.Text
  estado               Boolean?  @default(true) @map("tpv_estado")
  procesado            Boolean?  @default(false) @map("tpv_procesado")
  creado               DateTime? @default(now()) @map("tpv_creado") @db.Timestamptz()
  actualizado          DateTime? @default(now()) @map("tpv_actualizado") @db.Timestamptz()

  @@index([mantenimientoId])
  @@index([procesado])
  @@map("tbl_preventivos")
  @@schema("sicov")
}

model Correctivo {
  id                   Int       @id @default(autoincrement()) @map("tcv_id")
  placa                String?   @map("tcv_placa") @db.VarChar(6)
  fecha                DateTime? @map("tcv_fecha") @db.Date
  hora                 String?   @map("tcv_hora") @db.VarChar(8)
  nit                  BigInt?   @map("tcv_nit")
  razonSocial          String?   @map("tcv_razon_social") @db.VarChar(200)
  tipoIdentificacion   Int?      @map("tcv_tipo_identificacion")
  numeroIdentificacion String?   @map("tcv_numero_identificacion") @db.VarChar(255)
  nombresResponsable   String?   @map("tcv_nombres_responsable") @db.VarChar(200)
  mantenimientoId      Int?      @map("tcv_mantenimiento_id")
  // Columna ADITIVA 003 (gate B1): id externo separado; el enlace local nunca se sobrescribe.
  mantenimientoIdExterno Int?    @map("tcv_mantenimiento_id_externo")
  detalleActividades   String?   @map("tcv_detalle_actividades") @db.Text
  estado               Boolean?  @default(true) @map("tcv_estado")
  procesado            Boolean?  @default(false) @map("tcv_procesado")
  creado               DateTime? @default(now()) @map("tcv_creado") @db.Timestamptz()
  actualizado          DateTime? @default(now()) @map("tcv_actualizado") @db.Timestamptz()

  @@index([mantenimientoId])
  @@index([procesado])
  @@map("tbl_correctivos")
  @@schema("sicov")
}

/// Cola de sincronización de mantenimientos (tipos alistamiento/autorizacion reservados para 006/007).
model MantenimientoJob {
  id                   Int       @id @default(autoincrement()) @map("tmj_id")
  tipo                 String    @map("tmj_tipo") @db.VarChar(20)
  mantenimientoLocalId Int?      @map("tmj_mantenimiento_local_id")
  detalleId            Int?      @map("tmj_detalle_id")
  vigiladoId           String    @map("tmj_vigilado_id") @db.VarChar(30)
  usuarioDocumento     String    @map("tmj_usuario_documento") @db.VarChar(30)
  rolId                Int       @map("tmj_rol_id")
  estado               String    @default("pendiente") @map("tmj_estado") @db.VarChar(30)
  reintentos           Int       @default(0) @map("tmj_reintentos")
  ultimoError          String?   @map("tmj_ultimo_error") @db.Text
  siguienteIntento     DateTime? @default(now()) @map("tmj_siguiente_intento") @db.Timestamptz()
  payload              Json?     @map("tmj_payload") @db.Json
  creado               DateTime? @default(now()) @map("tmj_creado") @db.Timestamptz()
  actualizado          DateTime? @default(now()) @map("tmj_actualizado") @db.Timestamptz()

  @@index([estado, siguienteIntento], map: "tmj_estado_intento_idx")
  @@index([vigiladoId])
  @@index([mantenimientoLocalId])
  @@map("tbl_mantenimiento_jobs")
  @@schema("sicov")
}
```

> **Nota BigInt:** `nit` y `tmt_usuario_id` BigInt exigen serialización explícita en respuestas JSON
> (`Number(...)`/`String(...)`) — cuidarlo en rutas y tests.
> **Nota migración:** `add_mantenimientos` se genera con `npx prisma migrate dev --create-only` y se
> revisa el SQL (solo CREATE) antes de aplicar — constitución §1.2.

## Seed (aditivo)

- 4 tipos de mantenimiento.
- **Los 7 módulos asignables (D-017/D-018):** Usuarios · Novedades · Mantenimientos ·
  Autorizaciones · Alistamientos · **Salidas** · **Llegadas**, con asignaciones demo coherentes
  (§10.1: admin no opera; cliente asigna a sus operadores — los usuarios demo de despachos/llegadas
  reciben Salidas/Llegadas para que los 52 tests sigan verdes con el guard).
- Datos demo: 2 mantenimientos base (1 preventivo, 1 correctivo) con detalle procesado, 1 job
  `fallido` para probar corregir-y-reenviar, 1 archivo de programa demo (registro sin archivo
  físico; el binario llega en 005-B).

## Catálogo de tipos de identificación (D-022 #5 — constante de código, NO tabla)

Vive en `src/lib/mantenimientos/tipos.ts` (usado por plantilla, validación `1..12` y UI):
`1` Cédula de ciudadanía · `2` Cédula de extranjería · `3` Pasaporte · `4` Cédula de ciudadanía
digital · `5` Tarjeta de identidad · `6` Registro civil · `7` PEP · `8` DIE · `9` NIT · `10` NN ·
`11` Carnet Diplomático · `12` Permiso por Protección Temporal.
