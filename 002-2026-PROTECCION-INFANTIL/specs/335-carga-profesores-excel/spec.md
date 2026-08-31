# Feature Specification: Carga masiva de profesores por Excel

**Feature Branch**: `work/pi-SPEC-335-carga-profesores`

**Created**: 2026-08-31

**Status**: DESARROLLO

**Input**: Prioridad CEO directa (2026-08-31). Hoy la carga masiva (`/api/colegio/carga/*`) cubre **solo alumnos**; los profesores se crean uno a uno. El rector necesita subir N profesores por plantilla Excel, ver qué pasó con cada fila, y que **no se dupliquen**.

**Impacto en arquitectura:** Sin migración — `Profesor` ya tiene `@@unique([colegioId, tipoDocumento, numeroDocumento])`. Se agregan 3 endpoints bajo `/api/colegio/carga-profesores/` (plantilla · validar · confirmar) reusando el patrón del flujo de alumnos (parser xlsx/csv, token firmado de carga, validación por fila) y la UI de carga en la pantalla de Profesores. `arch:check` regenera `02-roles-capacidades.md` por las rutas nuevas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El rector sube varios profesores de una vez, sin duplicar (Priority: P1)

El rector descarga una plantilla, la llena con varios profesores, la sube, ve un **resumen por fila** (cuáles se crearán, cuáles se omiten porque ya existen, cuáles tienen error), confirma, y los profesores quedan cargados. Si vuelve a subir el mismo archivo, no se duplica nada.

**Why this priority**: Es el frente completo; hoy cargar 30 profesores es 30 formularios.

**Independent Test**: Subir un Excel con varios profesores (algunos repetidos entre sí y/o ya existentes), ver el resumen creados/omitidos/errores, confirmar, y verificar en la pantalla de Profesores que quedaron sin duplicados.

**Acceptance Scenarios**:

1. **Given** un rector en la pantalla de Profesores, **When** pulsa descargar plantilla, **Then** obtiene un archivo con las columnas requeridas y una fila de ejemplo.
2. **Given** un archivo con N profesores válidos, **When** lo sube, **Then** ve un resumen que lista, por fila, si se creará, si se omite (y por qué) o si tiene error (y cuál).
3. **Given** el resumen, **When** confirma, **Then** se crean los profesores válidos y la pantalla muestra cuántos se crearon, cuántos se omitieron y cuántos fallaron.
4. **Given** un archivo con un profesor cuya identidad (tipo+número de documento) **ya existe** en el colegio, **When** valida, **Then** esa fila se marca **"omitido: ya existe por documento"** (se reporta, no se silencia) y al confirmar **no se duplica**.
5. **Given** un archivo con dos filas de **la misma identidad**, **When** valida, **Then** la segunda se marca como duplicada dentro del archivo y solo se crea una.
6. **Given** el mismo archivo subido dos veces, **When** se confirma la segunda vez, **Then** no se crea ningún profesor nuevo (idempotente) y todas las filas figuran como omitidas.
7. **Given** una fila con datos inválidos (tipo de documento inexistente/inactivo, sexo fuera de M|F|OTRO, email inválido, año de nacimiento inválido), **When** valida, **Then** esa fila se marca con error explicando el motivo y **no** se crea.

### Edge Cases

- **Archivo vacío o sin encabezados válidos** → error claro, no se crea nada.
- **Archivo con todas las filas ya existentes** → resumen "0 creados, N omitidos"; confirmar no cambia nada.
- **Columnas faltantes** → error de formato indicando qué columna falta.
- **Confirmación fuera de tiempo / token inválido** → se rechaza; el rector vuelve a subir.
- **Aislamiento por colegio**: un rector solo carga profesores de su propio colegio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir una plantilla descargable de profesores con las columnas requeridas y una fila de ejemplo.
- **FR-002**: El sistema DEBE aceptar un archivo (CSV/XLSX) con varias filas de profesores y validarlo **antes** de crear nada.
- **FR-003**: La validación DEBE reportar, por fila: **crear**, **omitir** (con motivo) o **error** (con motivo).
- **FR-004**: Una fila cuya identidad (tipo+número de documento) ya exista en el colegio DEBE marcarse **"omitido: ya existe por documento"** — reportado, nunca en silencio.
- **FR-005**: Dos filas con la misma identidad dentro del archivo DEBEN resolverse creando **una sola**; la otra se reporta como duplicada del archivo.
- **FR-006**: La confirmación DEBE crear solo las filas válidas y no duplicar; resubir el mismo archivo NO crea nada nuevo (idempotente).
- **FR-007**: La validación por fila DEBE verificar: tipo de documento existente y **activo** en el catálogo, sexo en (M|F|OTRO), email con formato válido, año de nacimiento válido, y campos obligatorios presentes.
- **FR-008**: El rector DEBE ver, tras confirmar, cuántos se crearon, cuántos se omitieron y cuántos fallaron.
- **FR-009**: La carga DEBE estar aislada por colegio (el rector solo carga en el suyo) y protegida por el permiso de módulo correspondiente.

### Key Entities *(include if feature involves data)*

- **Profesor** (existente, sin cambio de esquema): `colegioId`, nombre, apellidos, tipoDocumento, numeroDocumento, anioNacimiento, sexo, email, telefono, estado. Identidad única por `(colegioId, tipoDocumento, numeroDocumento)`.
- **TipoDocumento** (catálogo existente, solo lectura): valida la clave de tipo de documento y que esté activa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un archivo con N profesores válidos crea exactamente N profesores en una sola operación.
- **SC-002**: 0 duplicados: filas con identidad ya existente (o repetida en el archivo) nunca crean un segundo profesor.
- **SC-003**: 100% de las filas aparecen en el resumen clasificadas (crear / omitido con motivo / error con motivo).
- **SC-004**: Resubir el mismo archivo crea 0 profesores nuevos.

## Assumptions

- **Duplicado se REPORTA** en el resumen ("omitido: ya existe por documento"), decisión del CEO — no se omite en silencio.
- **Sin migración**: la unicidad ya existe en `Profesor`.
- **Reuso**: parser (CSV/XLSX), token firmado de carga y patrón de validación del flujo de alumnos; catálogo `TipoDocumento`; UI de carga análoga a la existente.
- **DONE (navegador)**: subo un Excel con varios profesores (algunos repetidos), veo resumen creados/omitidos/errores, confirmo y no se duplica. Evidencia en el PR.
- **Fuera de alcance**: `/dashboard/padre` (otro dev), cambiar la carga de alumnos, editar/eliminar profesores en lote, identificadores de profesor.
- **Solo-lectura**: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`, el motor de notificaciones, el flujo de carga de alumnos existente (se reusa, no se modifica).
