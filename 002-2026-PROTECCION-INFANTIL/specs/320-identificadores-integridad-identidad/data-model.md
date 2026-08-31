# Data Model — SPEC-320

## 1. `TipoDocumento` (catálogo nuevo · §2.3)

Patrón `Plataforma` (`schema.prisma:1525`).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | String `@id @default(cuid())` | |
| `clave` | String `@unique` | `RC`, `TI`, `CC`, `CE`, `PA`, `PEP`, `NIT`, `OTRO` |
| `nombre` | String | "Registro civil", "Cédula de ciudadanía", … |
| `categoria` | String `@default("persona")` | reservado; paralelo a `Plataforma.categoria` |
| `esActiva` | Boolean `@default(true)` | desactivar oculta del formulario, no borra registros |
| `creadoEn` | DateTime `@default(now())` | |

`@@index([clave])`, `@@index([esActiva])`.

**Seed idempotente** (`prisma/seed.ts`, `upsert` por `clave`): las 8 entradas de la norma colombiana. No preguntar a Jelkin.

**Consumo**: estudiante (`documentoTipo`), profesor (`tipoDocumento`), comité (`tipoIdentificacion`) validan que la clave exista y esté activa. No se agrega FK dura desde cada sujeto (se guarda la `clave` string, validada en aplicación) para no acoplar tres tablas al catálogo; la unicidad del catálogo vive en `TipoDocumento.clave`. *(Decisión abierta menor para implement: FK vs clave-validada; recomendación = clave validada, alineado con cómo estudiante ya guarda `documentoTipo` string.)*

## 2. `Profesor` extendido (§2.2)

Antes (`schema.prisma:1169`): `nombre, apellidos, email?, telefono?, estado`.

| Campo nuevo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `tipoDocumento` | String | sí | clave del catálogo `TipoDocumento` |
| `numeroDocumento` | String | sí | |
| `anioNacimiento` | Int | sí | |
| `sexo` | String | sí | set cerrado en Zod (p. ej. `M|F|OTRO`) |
| `telefono` | String | sí | **deja de ser nullable** |
| `email` | String | sí | **deja de ser nullable** |

- **Llave humana**: `@@unique([colegioId, tipoDocumento, numeroDocumento])`.
- La llave de red social (identificadores) es la del producto — van las dos.
- **Migración C** (ver R5, actualizado en PARA): columnas `NOT NULL` **sin default**, diseñadas asumiendo **tabla vacía**. Las 2 filas vivas de `Profesor` (data desechable) + sus filas hijas de identificador se **truncan en la ventana de deploy, ANTES de esta migración** — paso **destructivo que corre el CEO**, no el Dev ni Fábrica. Anotado como prerequisito de deploy en plan.md. No se usa temp-default (un default constante en `numeroDocumento` violaría el UNIQUE `(colegioId, tipoDocumento, numeroDocumento)` si dos filas comparten colegio; y el brief pidió "sin backfill").

## 3. Identificadores — unicidad por colegio (§2.1)

### 3.1 `IdentificadorEstudiante` (tabla `IdentificadorAlumno`)

| Cambio | Detalle |
|---|---|
| **+ `colegioId String`** (H1) | FK a `Colegio`; `@@index([colegioId, estado])`. Backfill desde `Alumno.colegioId`. `crear()` empieza a escribirlo. |
| `@@unique` reordenado (H3) | de `[estudianteId, valor, tipo, plataformaId]` → forma normalizada por colegio (ver 3.4). |

### 3.2 `IdentificadorAcudiente` / `IdentificadorProfesor`

Ya tienen `colegioId`. Solo se normaliza el `@@unique` a la forma por colegio (3.4). Sin cambio de columnas.

### 3.3 Semántica de unicidad (opción A · **diseño ASIMÉTRICO**, cerrado en PARA por Fábrica 2026-08-30)

La protección dura de BD es **asimétrica por sujeto**, porque las tablas tienen cardinalidad distinta respecto a "una persona":

| Sujeto | Constraint dura de BD | Razón |
|---|---|---|
| **Estudiante** | `UNIQUE (colegioId, tipo, valor, plataformaId) WHERE estado='activo'` NULLS NOT DISTINCT | Un alumno tiene una sola fila por colegio; dos alumnos del colegio con el mismo identificador es el bug I-213. Acá va la **red dura de BD** que pidió el CEO. Requiere `colegioId` denormalizado (H1). |
| **Profesor** | `UNIQUE (colegioId, tipo, valor, plataformaId) WHERE estado='activo'` NULLS NOT DISTINCT | Igual que estudiante: dos profesores del colegio con el mismo identificador es el bug. Red dura de BD. |
| **Acudiente** | `UNIQUE (acudienteId, tipo, valor, plataformaId) WHERE estado='activo'` NULLS NOT DISTINCT — **se mantiene por-acudiente, NO por-colegio** | **Excepción documentada:** `AcudienteEstudiante` es `@@unique([estudianteId, orden, estado])` (schema:1257) → **una fila de acudiente por (estudiante, orden)**. Un padre con dos hijos en el colegio tiene DOS filas de acudiente, y su mismo Instagram va legítimamente en dos `IdentificadorAcudiente` del mismo colegio. La BD NO puede bloquear eso; el cruce entre filas de acudiente lo cubre el warn de aplicación. |

> ⚠️ **NO "unificar" la constraint de acudiente a `(colegioId, …)`.** El caso padre-de-dos-hijos (una persona = dos filas de acudiente en el mismo colegio, por el `@@unique([estudianteId, orden, estado])` de `AcudienteEstudiante`) se rompería. Esta excepción es deliberada; queda escrita aquí para que nadie la "limpie".

- **Índice PARCIAL `WHERE estado='activo'`**: las tres tablas de identificador tienen `estado String @default("activo")` (Estudiante schema:1355, Profesor:1310, Acudiente:1286). El índice parcial evita que una fila inactiva/histórica bloquee una nueva activa con el mismo valor.
- **`NULLS NOT DISTINCT`** (PG16, SQL crudo aditivo): trata "sin plataforma" como caso único (R3).

### 3.4 Warn-con-override cross-sujeto (en aplicación · los tres sujetos)

- Nuevo servicio `identificador-unicidad.ts`: consulta las tres tablas por `(colegioId, valor)` (valor normalizado, solo `estado='activo'`); si el mismo valor está en **otra persona** del colegio, devuelve `{ pertenece: [{ nombre, rol }] }`.
- El route responde con un **aviso** (no 409 automático); el override se confirma desde el cliente (`confirmarCompartido: true`) y se audita (FR-018). **Nunca bloquea en seco.**
- Cubre todos los pares cross-sujeto (profesor+acudiente, estudiante+acudiente, estudiante+profesor) y también el cruce entre filas de acudiente que la BD deja pasar.
- Entre colegios distintos: sin aviso (aislamiento por tenant). La consulta SIEMPRE lleva `colegioId`.

## 4. Mapa de migración de vocabulario (§2.3 · H2)

| Origen | Valor viejo | Clave catálogo |
|---|---|---|
| Estudiante Zod | `RC/TI/CC/CE/PASAPORTE/OTRO` | `RC/TI/CC/CE/PA/OTRO` (`PASAPORTE`→`PA`) |
| Comité enum (6 sitios) | `CEDULA_CIUDADANIA` | `CC` |
| Comité enum | `CEDULA_EXTRANJERIA` | `CE` |
| Comité enum | `PASAPORTE` | `PA` |
| Comité enum | `OTRO` | `OTRO` |

Los 6 sitios del comité a re-apuntar al catálogo: `schema.prisma:419`, `schemas/index.ts:415`, `admin/comite/integrantes/route.ts:10`, `admin/comite/integrantes/[id]/route.ts:10`, `colegio/comite/integrantes/[id]/route.ts:17`, `dal/types/comite.ts:25,35`. **Ninguno afuera** (candado 22 v5). La migración de datos actualiza las filas de comité existentes al nuevo valor de clave.

## 5. `AlertaColegio` — sin cambio de esquema

No se toca. El beneficio (una sola alerta por colegio, FR-006/SC-002) se logra porque, corregida la unicidad, deja de haber varias personas del mismo colegio con el mismo identificador generando varios candidatos en `alertas.ts`. `alertas.ts` y `buscarActivosPorValor` (cross-tenant) **no se tocan**.
