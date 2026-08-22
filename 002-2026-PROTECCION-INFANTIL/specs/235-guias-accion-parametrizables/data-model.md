> # Data Model — SPEC-235 · Guías de acción parametrizables

**Date**: 2026-08-22
**Feature**: specs/235-guias-accion-parametrizables/spec.md

---

## Nuevo enum: `EstadoGuiaAccion`

```prisma
enum EstadoGuiaAccion {
  BORRADOR
  PENDIENTE_APROBACION_COMITE
  ACTIVA
  REEMPLAZADA
}
```

---

## Nuevo modelo: `GuiaAccionCategoria`

Representa una guía de acción editorial por categoría de riesgo. Solo puede existir una guía `ACTIVA` por categoría (índice único parcial manual).

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | Identificador único |
| `categoria` | String | | Valor canónico de `CategoriaConducta` (ej. `GROOMING`) |
| `versionSecuencial` | Int | `@default(1)` | Versión editorial de la guía |
| `tituloEmocional` | String | | Título orientado al usuario final |
| `subtitulo` | String? | | Subtítulo opcional |
| `categoriaBadgeTexto` | String | | Texto del badge de categoría en UI |
| `pasosJson` | Json | | Array `{orden, tipo, titulo, descripcion}` |
| `calloutTitulo` | String? | | Título del callout destacado |
| `calloutTexto` | String? | | Cuerpo del callout destacado |
| `botonesAccionJson` | Json | | Array `{tipo, texto, subtexto?, url\|tel, primario\|urgente\|secundario}` |
| `piePagina` | String? | | Pie de página con disclaimers |
| `estado` | EstadoGuiaAccion | `@default(BORRADOR)` | Estado del ciclo de vida |
| `aprobadaPorComiteJson` | Json? | | Array de votos `{comiteId, email, nombre, aprobadoEn}` |
| `creadaPorAdminId` | String | FK → `Usuario.id` | Admin que creó la guía |
| `createdAt` | DateTime | `@default(now()) @db.Timestamptz(6)` | Creación de la fila |
| `publicadaEn` | DateTime? | `@db.Timestamptz(6)` | Momento de paso a `ACTIVA` |
| `reemplazadaEn` | DateTime? | `@db.Timestamptz(6)` | Momento de paso a `REEMPLAZADA` |

```prisma
model GuiaAccionCategoria {
  id                    String             @id @default(cuid())
  categoria             String
  versionSecuencial     Int                @default(1)
  tituloEmocional       String
  subtitulo             String?
  categoriaBadgeTexto   String
  pasosJson             Json
  calloutTitulo         String?
  calloutTexto          String?
  botonesAccionJson     Json
  piePagina             String?
  estado                EstadoGuiaAccion   @default(BORRADOR)
  aprobadaPorComiteJson Json?
  creadaPorAdminId      String
  createdAt             DateTime           @default(now()) @db.Timestamptz(6)
  publicadaEn           DateTime?          @db.Timestamptz(6)
  reemplazadaEn         DateTime?          @db.Timestamptz(6)

  creadaPor Usuario @relation(fields: [creadaPorAdminId], references: [id], name: "GuiasAccionCreadas")

  @@index([categoria, estado])
  @@index([estado])
  @@index([creadaPorAdminId])
}
```

**Relación inversa en `Usuario`**:

```prisma
model Usuario {
  // ... campos existentes ...
  guiasAccionCreadas GuiaAccionCategoria[] @relation("GuiasAccionCreadas")
}
```

---

## Enum `AccionAudit` modificado

Agregar al final del enum existente:

```prisma
enum AccionAudit {
  // ... valores existentes ...
  // SPEC-235 (002-PI-padre-lote-core): ciclo de vida de guías de acción.
  GUIA_ACCION_CREADA
  GUIA_ACCION_EDITADA
  GUIA_ACCION_ENVIADA_COMITE
  GUIA_ACCION_APROBADA
  GUIA_ACCION_RECHAZADA
  GUIA_ACCION_PUBLICADA
  GUIA_ACCION_REEMPLAZADA
}
```

---

## Parámetro de sistema

```prisma
model ParametroSistema {
  clave: "padre.comite.miembros_minimos_aprobacion"
  valor: "2"
  tipo: INTEGER
  categoria: SYSTEM
}
```

Sembrado idempotentemente en `prisma/seed.ts` si no existe.

---

## Índice único parcial SQL manual

Prisma no soporta `WHERE` en `@@unique`. La unicidad lógica "una sola guía ACTIVA por categoría" se implementa con una migración SQL manual:

```sql
CREATE UNIQUE INDEX guia_accion_categoria_activa_idx
ON guia_accion_categoria (categoria)
WHERE estado = 'ACTIVA';
```

**Justificación**: permite tener múltiples versiones `BORRADOR`, `PENDIENTE_APROBACION_COMITE` y `REEMPLAZADA` de la misma categoría, pero garantiza que nunca haya dos guías `ACTIVA` simultáneas. El servicio captura el error de BD (`P2002`) y devuelve `409`.

---

## Migraciones

1. `20260822xx_add_guia_accion_categoria`
   - `CREATE TYPE EstadoGuiaAccion`.
   - `ALTER TYPE AccionAudit ADD VALUE` (7 valores nuevos).
   - `CREATE TABLE guia_accion_categoria` con columnas, FK e índices.
   - `CREATE UNIQUE INDEX guia_accion_categoria_activa_idx ON guia_accion_categoria(categoria) WHERE estado='ACTIVA'`.
   - Añadir relación inversa en `Usuario`.

---

## Invariantes

- Solo existe una guía `ACTIVA` por categoría (garantía de BD).
- Una guía `ACTIVA` no se edita; cualquier cambio requiere una nueva versión (`BORRADOR` → aprobación).
- Una guía `REEMPLAZADA` nunca vuelve a `ACTIVA`.
- El admin creador siempre es un usuario con `rol=ADMIN`.
- Los votos del comité se acumulan en `aprobadaPorComiteJson`; al rechazar se limpia el array.
