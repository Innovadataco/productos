# Data Model — Oportunidades

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> **Identidad técnica conservada (SC-011)**: el modelo Prisma sigue siendo `Licitacion`
> (tabla `licitaciones`) y las rutas `/api/licitaciones`. "Oportunidad" es el concepto de
> cara al usuario. Esto minimiza el riesgo de la migración sobre datos vivos.

## `TipoOportunidad` (nuevo catálogo configurable)

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `Int @id @default(autoincrement())` | catálogo pequeño (patrón de estados/entidades) |
| `key` | `String @unique` | slug estable para seed idempotente |
| `nombreOficial` | `String` | nombre visible |
| `exigeNumero` | `Boolean @default(false)` | **la propiedad configurable** que sustituye el `if` por nombre (§0.7) |
| `exigeFechaApertura` | `Boolean @default(false)` | idem |
| `createdAt`/`updatedAt` | `DateTime` | |

**Seed (idempotente, D-048):**

| key | nombreOficial | exigeNumero | exigeFechaApertura |
|---|---|---|---|
| `licitacion-publica` | Licitación pública | **true** | **true** |
| `concurso-meritos` | Concurso de méritos | false | false |
| `contratacion-directa` | Contratación directa | false | false |

## `Licitacion` — cambios (tabla `licitaciones`, datos vivos)

| Campo | Antes | Después | Motivo |
|---|---|---|---|
| `numero` | `String` (NOT NULL) | `String?` | opcional; lo exige el tipo (FR-003) |
| `fechaApertura` | `DateTime` (NOT NULL) | `DateTime?` | opcional; es además el hito *apertura* del cronograma |
| `tipoId` | — | `Int?` → FK `TipoOportunidad` | tipo de la oportunidad (FR-002). `@@index([tipoId])` |
| `ciudadEjecucion` | — | `String?` | FR-009 |
| `fechaPliegosDefinitivos` | — | `DateTime?` | cronograma (FR-007) |
| `fechaEntregaPropuesta` | — | `DateTime?` | cronograma |
| `fechaAdjudicacion` | — | `DateTime?` | cronograma |
| `fechaCierre` | — | `DateTime?` | cronograma |
| `partidas` | — | `PartidaPresupuesto[]` | presupuesto desglosado (FR-008) |
| `@@unique([numero, fechaApertura])` | — | **conservado, documentado** | con nullables, solo ata a las que tienen ambos (FR-006) |

Se conservan `estadoId` (SPEC-007 lo evolucionará), `entidadId` (ya nullable), `areaIdSala`,
`titulo`, `descripcion`, `documentoUrl`, `contenido`, y la relación `documentos`
(expediente).

## `PartidaPresupuesto` (nuevo — presupuesto desglosado)

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `licitacionId` | `String` | FK CASCADE → `Licitacion` |
| `concepto` | `String` | qué cubre la partida |
| `monto` | `Decimal @db.Decimal(18,2)` | validado ≥ 0 en la ruta |
| `moneda` | `String @default("COP")` | cada partida su moneda (no se asume una sola) |

El **total** se calcula al leer (suma de `monto`), no se almacena.

## `LicitacionDocumento` (expediente — ya existe, se reutiliza)

Sin cambios de esquema: ya tiene `licitacionId` con **CASCADE**, `nombre`, `tipo`,
`fechaInicio/Fin/Corte`, `createdAt`. Lo que falta es la **ruta de subida** (plan bloque 3).
**Nunca** genera `DocumentoChunk` ni pasa por embeddings (FR-013, SC-008): es adjunto.

## `EntidadLicitacion` (info ampliada — aditiva, opcional)

| Campo nuevo | Tipo | Nota |
|---|---|---|
| `nit` | `String?` | identificación tributaria |
| `sitioWeb` | `String?` | |
| `telefono` | `String?` | |
| `direccion` | `String?` | |
| `ciudad` | `String?` | |

Todos opcionales → las filas sembradas existentes no se rompen (FR-010).

## Orden de la migración (seguro sobre datos vivos — R-01/R-02)

1. `CREATE TABLE "TipoOportunidad"`, `CREATE TABLE "PartidaPresupuesto"`, columnas nuevas en
   `licitaciones` y `EntidadLicitacion` (nullable / con default).
2. Sembrar los 3 tipos.
3. `UPDATE "licitaciones" SET "tipoId" = <id licitación-publica> WHERE "tipoId" IS NULL` —
   toda oportunidad existente queda "licitación pública" conservando `numero`/`fechaApertura`
   (FR-004).
4. **Después** del backfill: `ALTER COLUMN "numero" DROP NOT NULL`, `ALTER COLUMN
   "fechaApertura" DROP NOT NULL`.

**Verificación obligatoria (SC-003)** en BD desechable antes de la viva: `count(*)` de
`licitaciones`, `LicitacionStatus` y `EntidadLicitacion` idéntico antes y después.
