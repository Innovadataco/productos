# Modelo de datos 030 — Círculo de Confianza

## Modelos

### `ContactoConfianza` (nuevo)

Representa una persona cercana al menor.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | `String @id @default(cuid())` | Identificador del contacto. |
| `usuarioId` | `String` | FK a `Usuario` (ON DELETE CASCADE). |
| `etiqueta` | `String?` | Nombre o etiqueta descriptiva, ej. "Tío". |
| `nota` | `String?` | Nota libre del usuario. |
| `activo` | `Boolean @default(true)` | Contacto activo/inactivo. |
| `creadoEn` | `DateTime @default(now())` | - |
| `actualizadoEn` | `DateTime @updatedAt` | - |

Relaciones:

- `usuario Usuario @relation(...)`
- `identificadores IdentificadorContacto[]`

### `IdentificadorContacto` (nuevo)

Representa un medio de contacto de una persona.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | `String @id @default(cuid())` | - |
| `contactoId` | `String` | FK a `ContactoConfianza` (ON DELETE CASCADE). |
| `valor` | `String` | Valor real: teléfono, nick, usuario, etc. |
| `tipo` | `String?` | Tipo semántico: "telefono", "nick", "usuario", "email", etc. |
| `plataformaId` | `String?` | FK opcional a `Plataforma`. |
| `activo` | `Boolean @default(true)` | Identificador activo/inactivo. |
| `creadoEn` | `DateTime @default(now())` | - |
| `actualizadoEn` | `DateTime @updatedAt` | - |

Relaciones:

- `contacto ContactoConfianza @relation(...)`
- `plataforma Plataforma? @relation(...)`

### `Usuario` (actualizado)

- `contactosConfianza ContactoConfianza[]` (apunta al nuevo modelo).

### `Plataforma` (actualizado)

- Se elimina la relación `contactosConfianza` directa.
- Se agrega `identificadoresContacto IdentificadorContacto[]` como relación inversa de `IdentificadorContacto.plataforma`.

## Constraints e índices

- `ContactoConfianza`:
  - `@@index([usuarioId, activo])`
  - `@@index([usuarioId, creadoEn])` (opcional, útil para listado).

- `IdentificadorContacto`:
  - `@@unique([contactoId, valor, plataformaId])`: un mismo contacto no puede tener un valor+plataforma duplicados.
  - `@@index([valor])`: búsqueda de reportes por valor sin importar plataforma.
  - `@@index([contactoId, activo])`: listado rápido de identificadores activos de un contacto.
  - `@@index([plataformaId])`: relación inversa.

## Migración de datos

Cada registro de la tabla vieja `ContactoConfianza` (usuarioId, identificador, plataformaId, etiqueta, activo, creadoEn, actualizadoEn) se convierte en:

- Un registro en la nueva tabla `ContactoConfianza` con la misma `id`, `usuarioId`, `etiqueta`, `activo`, `creadoEn`, `actualizadoEn` y `nota` = NULL.
- Un registro en `IdentificadorContacto` con `contactoId` = `id` del contacto viejo, `valor` = `identificador`, `plataformaId` = `plataformaId`, `tipo` = NULL, `activo` = `activo`, `creadoEn` y `actualizadoEn` = mismos valores.

### SQL conceptual de la migración

```sql
-- 1. Renombrar tabla vieja para conservar datos
ALTER TABLE "ContactoConfianza" RENAME TO "ContactoConfianzaViejo";

-- 2. Crear tablas nuevas (PK, FK, índices, unique constraints)
--    (según el SQL generado por Prisma Migrate para el nuevo schema)

-- 3. Copiar contactos
INSERT INTO "ContactoConfianza" (
    "id", "usuarioId", "etiqueta", "nota", "activo", "creadoEn", "actualizadoEn"
)
SELECT
    "id", "usuarioId", "etiqueta", NULL, "activo", "creadoEn", "actualizadoEn"
FROM "ContactoConfianzaViejo";

-- 4. Copiar identificadores
INSERT INTO "IdentificadorContacto" (
    "id", "contactoId", "valor", "tipo", "plataformaId", "activo", "creadoEn", "actualizadoEn"
)
SELECT
    gen_random_uuid()::text, "id", "identificador", NULL, "plataformaId", "activo", "creadoEn", "actualizadoEn"
FROM "ContactoConfianzaViejo";

-- 5. Eliminar tabla vieja
DROP TABLE "ContactoConfianzaViejo";
```

## Notas

- El `id` de cada contacto viejo se reutiliza como `id` del contacto nuevo, simplificando la migración y manteniendo posibles referencias externas.
- El `id` de cada identificador nuevo se genera con `gen_random_uuid()` porque los IDs de Prisma son `String` generados por el cliente; la base de datos no requiere que sea un CUID específico.
- La relación `Plataforma.contactosConfianza` se reemplaza por `Plataforma.identificadoresContacto` porque ahora el identificador es quien opcionalmente conoce una plataforma.
