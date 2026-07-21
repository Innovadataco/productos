# Data Model: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073)

**Date**: 2026-07-21
**Feature**: specs/073-ubicacion-departamentos/spec.md

---

## Active Entities

### `Pais` (existente, sin cambios funcionales)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `codigo` | String | `@unique` | Ej: "CO" |
| `nombre` | String | | Ej: "Colombia" |
| `esActivo` | Boolean | `@default(true)` | |
| `creadoEn` | DateTime | `@default(now())` | |

**Relaciones inversas**: `ciudades`, `departamentos` (nueva), `reportes`.

---

### `Departamento` (nuevo)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `codigo` | String? | `@unique` | Código DANE opcional |
| `nombre` | String | | Ej: "Cundinamarca" |
| `paisId` | String | FK → `Pais.id` | |
| `esActivo` | Boolean | `@default(true)` | |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Validation Rules**:
- `nombre` + `paisId` deben ser únicos en práctica (aunque el índice unique formal sigue siendo `nombre, paisId` en `Ciudad`; para `Departamento` se usará `@@unique([nombre, paisId])`).

**State Transitions**: No aplica (dato maestro).

---

### `Ciudad` (modificado, aditivo)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `nombre` | String | | |
| `paisId` | String | FK → `Pais.id` | **Se mantiene** para compatibilidad |
| `departamentoId` | String? | FK → `Departamento.id`, nullable | **Nuevo** |
| `lat` | Float? | | |
| `lng` | Float? | | |
| `esActivo` | Boolean | `@default(true)` | |
| `creadoEn` | DateTime | `@default(now())` | |

**Validation Rules**:
- `@@unique([nombre, paisId])` se mantiene.
- `departamentoId` es nullable; ciudades de otros países o no mapeadas pueden ser null.

**State Transitions**: No aplica.

---

## Entity Relationships

```
Pais ||--o{ Departamento : "departamentos"
Pais ||--o{ Ciudad : "ciudades"
Departamento ||--o{ Ciudad : "ciudades"
Ciudad ||--o{ Reporte : "reportes"
```

---

## Data Access

### Endpoints existentes (sin cambios en esta fase)

- `GET /api/paises`: devuelve lista de países activos.
- `GET /api/ciudades?paisId=...`: devuelve lista de ciudades activas del país, más opción "Otra ciudad o municipio".

**Response shape se mantiene**:
```json
{
  "ciudades": [
    { "id": "cuid-1", "nombre": "Bogotá", "paisId": "cuid-pais" }
  ]
}
```

### Seed de Colombia (nuevo)

El seed ejecutará:
1. Upsert de Colombia por `codigo = "CO"`.
2. Upsert de 33 departamentos por `(nombre, paisId)`.
3. Para cada ciudad colombiana existente: update de `departamentoId` si se encuentra match por nombre.
4. Upsert de ciudades principales (capitales + grandes ciudades) por `(nombre, paisId)`.

---

## Indexes

| Table | Fields | Reason |
|-------|--------|--------|
| `Departamento` | `paisId` | Búsqueda por país |
| `Departamento` | `esActivo` | Filtrado activos |
| `Departamento` | `nombre, paisId` | Unique natural |
| `Ciudad` | `paisId` | Existente |
| `Ciudad` | `departamentoId` | Nuevo; búsqueda por departamento |
| `Ciudad` | `esActivo` | Existente |
| `Ciudad` | `nombre, paisId` | Unique existente |

---

## Seed Data

### Colombia — 33 divisiones territoriales (32 departamentos + Bogotá D.C.)

Ver `research.md` para el listado completo con capitales.

### Ciudades principales a crear/actualizar (ejemplo)

- Bogotá, D.C. → Cundinamarca / Bogotá D.C.
- Medellín → Antioquia
- Cali → Valle del Cauca
- Barranquilla → Atlántico
- Cartagena → Bolívar
- Bucaramanga → Santander
- Pereira → Risaralda
- Manizales → Caldas
- Cúcuta → Norte de Santander
- Ibagué → Tolima

---

## Migrations

### Migración aditiva: `add_departamento`

1. Crear tabla `departamentos`.
2. Agregar columna `departamentoId` nullable a `ciudades`.
3. Agregar FKs e índices.
4. No modificar datos existentes; no eliminar columnas.

### Seed

- Idempotente; actualiza `departamentoId` de ciudades colombianas existentes sin crear duplicados.
