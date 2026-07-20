# Data Model: Validación uniforme (zod)

**Date**: 2026-07-20
**Feature**: specs/048-validacion-uniforme/spec.md

---

## Active Entities

Este spec **no modifica el modelo de datos** ni requiere migraciones. La validación de entrada se aplica exclusivamente en la capa de API antes de interactuar con Prisma.

### Entradas de validación reconocidas

| Input | Origen | Tipo | Ejemplo |
|-------|--------|------|---------|
| `id` | Parámetro de ruta | `cuid` | `admin/ia/evals/casos/[id]/desactivar` |
| `clave` | Parámetro de ruta | string notación punto | `config/parametros/[clave]` |
| `url` | Body | string ≤ 2000 | `admin/ia/ollama/probar` |
| `texto` | Body | string 1–4000 | `admin/ia/sandbox` |
| `parametrosOverride` | Body | objeto de claves numéricas/string | `admin/ia/sandbox` |
| `valor` | Body | string ≤ 4000 | `config/parametros/[clave]` |
| `tipo`, `categoria` | Body | enums del schema Prisma | `config/parametros/[clave]` |

---

## Entity Relationships

Ninguno. Este spec opera sobre la capa de validación de la API, no sobre el modelo relacional.

---

## Seed Data

No aplica. No se introducen datos base.

---

## Indexes

No aplica. No se crean ni modifican índices.

---

## Notas

- Los esquemas zod reflejan los tipos y restricciones del modelo Prisma (por ejemplo, `TipoParametro` y `CategoriaParametro`) sin duplicar el estado de la base de datos.
- Cualquier cambio futuro en el modelo debe reflejarse en los esquemas correspondientes de `src/lib/schemas`.
