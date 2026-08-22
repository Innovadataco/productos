# Modelo de datos — SPEC-210

## Cambio de schema

Migración **aditiva**. Se añaden 7 modelos de pagos, 7 enums nuevos y relaciones inversas en `Colegio`/`Usuario`. Los modelos placeholder `Plan`, `Subscription`, `BillingCycle` se conservan y se enriquecen con columnas nuevas; no se eliminan ni renombran columnas existentes.

## Enums

| Enum | Valores | Uso |
|---|---|---|
| `TipoTitular` | `COLEGIO`, `PADRE` | `Suscripcion.tipoTitular`, `Plan.tipoTitular`, `BonoPromocional.aplicaSoloA` |
| `EstadoSuscripcion` | `ACTIVA`, `EN_GRACIA`, `SUSPENDIDA`, `CANCELADA` | `Suscripcion.estado` |
| `DuracionPlan` | `MES_1`, `MES_2`, `MES_3`, `MES_6`, `MES_12` | `Plan.duracion`, `Pago.duracionCubierta` |
| `EstadoPago` | `PENDIENTE_AUTORIZACION`, `AUTORIZADO`, `RECHAZADO` | `Pago.estado` |
| `MetodoPago` | `TRANSFERENCIA`, `NEQUI`, `DAVIPLATA`, `PSE_MANUAL`, `EFECTIVO`, `CHEQUE`, `OTRO` | `Pago.metodoDeclarado` |
| `TipoBono` | `DESCUENTO_PCT`, `DESCUENTO_FIJO_USD`, `MESES_GRATIS` | `BonoPromocional.tipo` |
| `FuenteTasa` | `API`, `ADMIN_MANUAL` | `TasaCambio.fuente` |

## Modelos

### `Suscripcion`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `tipoTitular` | `TipoTitular` | `COLEGIO` o `PADRE` |
| `colegioId` | `String?` | FK a `Colegio`; poblado si `tipoTitular = COLEGIO` |
| `usuarioId` | `String?` | FK a `Usuario`; poblado si titular es padre o rector |
| `estado` | `EstadoSuscripcion` | |
| `planActualId` | `String` | FK a `Plan` |
| `contratoPDFUrl` | `String?` | Obligatorio para colegio en implementación futura |
| `fechaInicio` | `DateTime @db.Timestamptz(6)` | |
| `fechaFin` | `DateTime @db.Timestamptz(6)` | Inicio + duración del plan |
| `fechaCorteProgramado` | `DateTime? @db.Timestamptz(6)` | `fechaFin + pagos.gracia_dias` |
| `esFreemium` | `Boolean @default(false)` | |
| `freemiumFechaFin` | `DateTime? @db.Timestamptz(6)` | Solo si freemium |
| `codigoReferidoPropio` | `String @unique` | Generado al crear |
| `codigoReferidoUsado` | `String?` | Código de otro referidor |
| `monedaLocal` | `String @default("COP")` | Moneda del cliente |
| `paisCliente` | `String @default("CO")` | |
| `suspendidaEn` | `DateTime? @db.Timestamptz(6)` | |
| `canceladaEn` | `DateTime? @db.Timestamptz(6)` | |
| `canceladaPorUsuario` | `Boolean?` | `true` cliente, `false` admin |
| `motivoCancelacion` | `String?` | |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

Índices: `@@index([estado, fechaFin])`, `@@index([tipoTitular, estado])`.

Relaciones:
- `colegio Colegio?`
- `usuario Usuario?`
- `planActual Plan`
- `pagos Pago[]`
- `bonosAplicados BonoAplicado[]`
- `referidosCodigoPropio CodigoReferidoUso[] @relation("CodigoPropio")`
- `referidosUsados CodigoReferidoUso[] @relation("Referida")`

### `Plan`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `tipoTitular` | `TipoTitular` | |
| `duracion` | `DuracionPlan` | |
| `año` | `Int` | Año de vigencia de precios |
| `precioBaseUSD` | `Float` | Precio en USD |
| `descuentoAnualPct` | `Float?` | Override del descuento anual; usa parámetro global si null |
| `activo` | `Boolean @default(true)` | |
| `descripcion` | `String?` | |
| `creadoPorAdminId` | `String` | FK a `Usuario` |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

Constraints: `@@unique([tipoTitular, duracion, año])`, `@@index([activo, año])`.
Relación inversa: `suscripciones Suscripcion[]`.

> **Nota legacy**: el campo placeholder `precio` se conserva en BD para no perder datos; no se usa en la lógica nueva.

### `Pago`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `suscripcionId` | `String` | FK a `Suscripcion` |
| `duracionCubierta` | `DuracionPlan` | |
| `montoBaseUSD` | `Float` | |
| `descuentoAplicadoUSD` | `Float @default(0)` | |
| `montoNetoUSD` | `Float` | `base - descuento` |
| `tasaCambioAplicada` | `Float` | Inmovilizada al autorizar |
| `montoLocalPagado` | `Float` | Valor real pagado por el cliente |
| `monedaLocal` | `String` | |
| `metodoDeclarado` | `MetodoPago` | |
| `comprobanteAdjuntoUrl` | `String` | URL del comprobante (texto) |
| `comprobanteMimeType` | `String` | |
| `comprobanteHashSha256` | `String` | Dedup anti-fraude |
| `fechaReporte` | `DateTime @db.Timestamptz(6)` | Cuando el cliente subió el comprobante |
| `fechaAutorizacion` | `DateTime? @db.Timestamptz(6)` | Cuando admin autorizó |
| `estado` | `EstadoPago` | |
| `motivoRechazo` | `String?` | |
| `autorizadoPorAdminId` | `String?` | FK a `Usuario` |
| `bonoAplicadoId` | `String?` | FK a `BonoAplicado` |
| `codigoReferidoUsado` | `String?` | Snapshot del código |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

Índices: `@@index([suscripcionId, createdAt])`, `@@index([estado, fechaReporte])`.
Relaciones:
- `suscripcion Suscripcion`
- `autorizadoPor Usuario?`
- `bonoAplicado BonoAplicado?`

### `BonoPromocional`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `nombre` | `String @unique` | Ej: `BOGOTA_UNCOLI_2026` |
| `tipo` | `TipoBono` | |
| `valor` | `Float` | %, USD o meses |
| `vigenciaInicio` | `DateTime @db.Timestamptz(6)` | |
| `vigenciaFin` | `DateTime @db.Timestamptz(6)` | |
| `usosMaximosTotales` | `Int?` | `null` = ilimitado |
| `usosMaximosPorCliente` | `Int @default(1)` | |
| `aplicaANuevos` | `Boolean @default(true)` | |
| `aplicaARenovaciones` | `Boolean @default(false)` | |
| `aplicaSoloA` | `TipoTitular?` | `null` = ambos |
| `combinableConCodigoPersonal` | `Boolean @default(false)` | |
| `activo` | `Boolean @default(true)` | |
| `descripcion` | `String?` | |
| `creadoPorAdminId` | `String` | FK a `Usuario` |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

Índice: `@@index([activo, vigenciaInicio, vigenciaFin])`.
Relaciones: `creadoPor Usuario`, `usos BonoAplicado[]`.

### `BonoAplicado`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `bonoId` | `String` | FK a `BonoPromocional` |
| `suscripcionId` | `String` | FK a `Suscripcion` |
| `pagoId` | `String?` | FK a `Pago` |
| `aplicadoEn` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `descuentoUSD` | `Float` | Ahorro representado |

Índice: `@@index([bonoId, aplicadoEn])`.
Relaciones: `bono BonoPromocional`, `suscripcion Suscripcion`, `pago Pago?`.

### `CodigoReferidoUso`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `codigoReferidoUsuarioId` | `String` | FK `Suscripcion.id` del referidor |
| `suscripcionReferidaId` | `String` | FK `Suscripcion.id` del referido |
| `fechaRegistro` | `DateTime @default(now()) @db.Timestamptz(6)` | |
| `fechaActivacion` | `DateTime? @db.Timestamptz(6)` | Admin autoriza 1er pago |
| `recompensaOtorgada` | `Boolean @default(false)` | |
| `recompensaOtorgadaEn` | `DateTime? @db.Timestamptz(6)` | |
| `tipoRecompensa` | `String?` | Ej: `1_MES_GRATIS` |
| `año` | `Int` | Año del registro |
| `requiereRevisionAdmin` | `Boolean @default(false)` | Al 4º del año |
| `revisadaPorAdminId` | `String?` | FK a `Usuario` |
| `revisionOK` | `Boolean?` | |

Constraints: `@@unique([codigoReferidoUsuarioId, suscripcionReferidaId])`, `@@index([codigoReferidoUsuarioId, año])`.
Relaciones:
- `referidor Suscripcion @relation("CodigoPropio")`
- `referida Suscripcion @relation("Referida")`
- `revisadaPor Usuario?`

### `TasaCambio`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `monedaOrigen` | `String` | Ej: `USD` |
| `monedaDestino` | `String` | Ej: `COP` |
| `tasa` | `Float` | 1 origen = X destino |
| `fecha` | `DateTime @db.Timestamptz(6)` | |
| `fuente` | `FuenteTasa` | |
| `apiUrl` | `String?` | |
| `ingresadoPorAdminId` | `String?` | FK a `Usuario` |
| `motivoManual` | `String?` | |
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | |

Índice: `@@index([monedaDestino, fecha])`.
Relación: `ingresadoPor Usuario?`.

## Relaciones inversas en modelos existentes

- `Colegio.suscripciones Suscripcion[]`
- `Usuario.suscripciones Suscripcion[]`
- `Usuario.planesCreados Plan[]`
- `Usuario.bonosCreados BonoPromocional[]`
- `Usuario.pagosAutorizados Pago[]`
- `Usuario.referidosRevisados CodigoReferidoUso[]`
- `Usuario.tasasIngresadas TasaCambio[]`

## Seed

Ver `plan.md` y `quickstart.md`.
