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
- **Migración C** (ver R5): columnas añadidas con default temporal solo-migración para poblar las 2 filas vivas, default retirado en el mismo archivo → estado final `NOT NULL` sin default. Verificar conteo de profesores antes.

## 3. Identificadores — unicidad por colegio (§2.1)

### 3.1 `IdentificadorEstudiante` (tabla `IdentificadorAlumno`)

| Cambio | Detalle |
|---|---|
| **+ `colegioId String`** (H1) | FK a `Colegio`; `@@index([colegioId, estado])`. Backfill desde `Alumno.colegioId`. `crear()` empieza a escribirlo. |
| `@@unique` reordenado (H3) | de `[estudianteId, valor, tipo, plataformaId]` → forma normalizada por colegio (ver 3.4). |

### 3.2 `IdentificadorAcudiente` / `IdentificadorProfesor`

Ya tienen `colegioId`. Solo se normaliza el `@@unique` a la forma por colegio (3.4). Sin cambio de columnas.

### 3.3 Semántica de unicidad (opción A)

- **Protección dura de BD (por tabla, dentro del colegio)**: índice único con `NULLS NOT DISTINCT` (PG16, SQL crudo aditivo) sobre `("colegioId", "tipo", "valor", "plataformaId")` — evita el duplicado exacto accidental **y** trata "sin plataforma" como caso único (R3).
- **Warn-con-override (cross-sujeto, en aplicación)**: nuevo servicio `identificador-unicidad.ts` consulta las tres tablas por `(colegioId, valor)` (valor normalizado); si el mismo valor está en **otra persona** del colegio, devuelve `{ pertenece: { nombre, rol } }`. El route responde con un aviso (no 409 automático); el override se confirma desde el cliente y se audita (FR-018). No bloquea.

### 3.4 Forma normalizada del `@@unique` (los tres sujetos)

Índice de protección dura, por tabla:
```
UNIQUE (colegioId, tipo, valor, plataformaId) NULLS NOT DISTINCT
```
(El `sujetoId` no entra en la protección dura por-colegio: dos personas distintas del mismo colegio con el mismo `(tipo, valor, plataforma)` es justamente el caso que el **warn cross-sujeto** intercepta, no un rechazo de BD. El duplicado exacto que la BD sí rechaza es "la misma tupla repetida dentro del colegio". Ver contracts para el árbol de decisión completo.)

> **Nota de diseño para PARA**: hay dos lecturas del "duplicado exacto por-tabla". (a) `(sujetoId, tipo, valor, plataformaId)` = un sujeto no repite su propio identificador (comportamiento actual, conservado). (b) `(colegioId, tipo, valor, plataformaId)` = dentro del colegio nadie repite esa tupla exacta (más fuerte, pero chocaría con el caso legítimo profesor=padre si ambos registran el mismo Instagram con la misma plataforma). **Recomendación: mantener la protección dura en (a) `(sujetoId, tipo, valor, plataformaId)` con NULLS NOT DISTINCT, y dejar TODO el cruce cross-sujeto —incluido mismo tipo/plataforma— al warn-con-override.** Así la BD nunca rompe el caso legítimo y el rector siempre decide. Confirmar esta lectura en el PARA.

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
