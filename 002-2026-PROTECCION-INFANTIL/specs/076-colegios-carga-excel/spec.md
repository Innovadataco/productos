# Feature Specification: Colegios · Fase 3 — Carga masiva por Excel/CSV

**Feature Branch**: `feature/001-scaffolding`

**Spec**: `076-colegios-carga-excel`

**Created**: 2026-07-21

**Status**: CERRADA

**Input**: El SCHOOL_ADMIN debe poder subir un archivo Excel o CSV para cargar un curso completo (alumnos + identificadores) de una sola vez, con validación por fila y reporte de errores antes de confirmar. Reutiliza la validación de la Fase 2.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — SCHOOL_ADMIN descarga plantilla de carga (Priority: P2)

El administrador institucional necesita una plantilla vacía con las columnas esperadas para rellenarla y subirla.

**Why this priority**: Facilita la carga correcta y reduce errores de formato.

**Independent Test**: Un SCHOOL_ADMIN autenticado puede descargar un CSV/XLSX de plantilla con las columnas: `nombre_alumno`, `grado`, `anio_lectivo`, `tipo_identificador`, `valor_identificador`, `etiqueta_relacion`, `plataforma`.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado, **When** solicita la plantilla, **Then** recibe un archivo con encabezados y una fila de ejemplo válida.
2. **Given** un usuario no SCHOOL_ADMIN, **When** solicita la plantilla, **Then** recibe 403.

---

### User Story 2 — SCHOOL_ADMIN valida archivo antes de cargar (Priority: P1)

El administrador institucional sube un archivo y el sistema valida cada fila antes de persistir nada. Devuelve un reporte de errores por fila si los hay.

**Why this priority**: Evita cargar datos parciales o inválidos; permite corregir antes de confirmar.

**Independent Test**: Un SCHOOL_ADMIN sube un archivo con errores (nombre vacío, duplicados dentro del archivo, curso inválido) y recibe una lista detallada de errores sin que se persista nada.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN con un archivo CSV válido, **When** lo valida, **Then** el sistema responde con filas válidas listas para confirmar y cero errores.
2. **Given** un archivo con filas inválidas, **When** lo valida, **Then** recibe errores por fila con descripción clara.
3. **Given** un archivo con filas duplicadas (mismo alumno + identificador), **When** lo valida, **Then** el sistema detecta el duplicado interno.
4. **Given** un archivo que referencia un curso que ya existe en otro colegio, **When** lo valida, **Then** el sistema no lo detecta como duplicado (aislamiento por colegio).

**Edge Cases**:
- Archivo vacío o solo encabezados.
- Columnas faltantes o con nombres incorrectos.
- Filas con múltiples identificadores para el mismo alumno (una fila por identificador, alumno repetido).
- Valor de identificador duplicado para el mismo alumno dentro del archivo.
- Tipo de identificador no soportado.
- Etiqueta de relación fuera de los valores canónicos.
- Plataforma inexistente.

---

### User Story 3 — SCHOOL_ADMIN confirma carga masiva (Priority: P1)

Tras validar, el administrador institucional confirma la carga y el sistema crea los cursos, alumnos e identificadores correspondientes de forma transaccional.

**Why this priority**: Es el objetivo central de la fase: cargar muchos alumnos de una vez.

**Independent Test**: Un SCHOOL_ADMIN valida un archivo y luego confirma; se crean el curso, los alumnos y sus identificadores con aislamiento por colegio.

**Acceptance Scenarios**:

1. **Given** una validación previa exitosa, **When** el SCHOOL_ADMIN confirma, **Then** el sistema crea el curso, los alumnos y los identificadores, y devuelve resumen.
2. **Given** un archivo que crea un curso que ya existe en el mismo colegio (mismo nombre/grado/año), **When** confirma, **Then** el sistema reutiliza el curso existente (upsert por curso) y crea/actualiza alumnos e identificadores.
3. **Given** un alumno que ya existe en el curso, **When** confirma, **Then** el sistema reutiliza el alumno y agrega nuevos identificadores (sin duplicados).
4. **Given** una confirmación con token/id de validación expirado o modificado, **When** confirma, **Then** el sistema rechaza con 400.

**Edge Cases**:
- Confirmación con errores pendientes: rechazo.
- Confirmación que generaría duplicados en BD: rechazo con detalle.
- Colegio vencido/inactivo: 403.
- Archivo muy grande: tope configurable (default 500 filas).

---

## Edge Cases (generales)

- SCHOOL_ADMIN con colegio vencido o inactivo no puede cargar (403).
- ADMIN/OPERADOR/COMITE/PARENT no tienen acceso (403).
- No se expone información de otros colegios en errores.
- La carga es idempotente a nivel de curso/alumno/identificador (upsert por clave natural dentro del colegio).
- Los identificadores se normalizan igual que en Fase 2 (trim + minúsculas).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir al SCHOOL_ADMIN descargar una plantilla CSV/Excel de carga masiva.
- **FR-002**: El sistema DEBE aceptar archivos CSV y Excel (.xlsx) para carga masiva.
- **FR-003**: El sistema DEBE validar el archivo fila por fila antes de permitir la confirmación, reportando errores claros con número de fila.
- **FR-004**: El sistema DEBE reutilizar las mismas reglas de validación de Fase 2 para cursos, alumnos e identificadores.
- **FR-005**: El sistema DEBE crear el curso, alumnos e identificadores de forma transaccional al confirmar una carga válida.
- **FR-006**: El sistema DEBE aplicar upsert por curso (nombre + grado + año + colegio) y por alumno (nombre + curso + colegio) dentro del colegio del SCHOOL_ADMIN.
- **FR-007**: El sistema DEBE rechazar la confirmación si el archivo contiene errores o si el estado de validación es inválido.
- **FR-008**: El sistema DEBE limitar el tamaño de la carga (default 500 filas) para evitar abuso.
- **FR-009**: El sistema DEBE registrar auditoría (`COLEGIO_CARGA_MASIVA`) al confirmar una carga.
- **FR-010**: El sistema DEBE mantener el aislamiento por colegio; la carga nunca afecta datos de otro colegio.
- **FR-011**: El sistema DEBE aplicar el tema visual verde en la vista de carga masiva.
- **FR-012**: El sistema NO DEBE conectar los identificadores cargados con matching ni alertas en esta fase (reservado para Fase 4).

### Key Entities

- **CargaMasivaAlumnos**: entidad transitoria para validación/confirmación. No necesita persistencia en BD si se valida en memoria; se puede usar un token JWT firmado con el payload de filas válidas.
- **Parser**: `src/lib/colegio/carga/parser.ts` convierte CSV/Excel a estructura de filas.
- **Validator**: `src/lib/colegio/carga/validator.ts` valida filas y devuelve errores.
- **Importer**: `src/lib/colegio/carga/importer.ts` ejecuta la transacción de confirmación.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las filas inválidas son detectadas y reportadas antes de la confirmación.
- **SC-002**: La carga confirmada crea correctamente curso, alumnos e identificadores con aislamiento por colegio.
- **SC-003**: Todos los endpoints de Fase 3 tienen tests de integración.
- **SC-004**: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npx vitest run` pasan sin errores.
- **SC-005**: Deploy limpio con `./scripts/dev-restart.sh` y healthcheck ok.

---

## Assumptions

- La Fase 2 (spec 075) está cerrada con modelos `Curso`, `Alumno`, `IdentificadorAlumno`.
- El SCHOOL_ADMIN ya tiene UI y endpoints para ABM individual.
- Se instalará una librería para parsear Excel (ej. `xlsx`); CSV se parsea manualmente.
- El sistema de auditoría soporta agregar nuevas acciones `COLEGIO_*`.

---

## Implementación

### Resumen de cambios

- **Librería**: se agregó `xlsx` (SheetJS) a `package.json` para parsear archivos `.xlsx`.
- **Parser CSV**: se implementó `parseCsvManual` en `src/lib/colegio/carga/parser.ts` para evitar que XLSX convierta valores como `+573001234567` en números y pierda el signo `+`.
- **Validador**: `src/lib/colegio/carga/validator.ts` valida filas contra schemas de Fase 2, normaliza identificadores, resuelve plataforma por nombre y detecta duplicados internos.
- **Token de confirmación**: `src/lib/colegio/carga/token.ts` genera/verifica JWT con filas válidas y `colegioId`, duración 15 min.
- **Importer**: `src/lib/colegio/carga/importer.ts` ejecuta upsert transaccional de curso, alumno e identificadores dentro del colegio del SCHOOL_ADMIN.
- **Endpoints**: `src/app/api/colegio/carga/plantilla/route.ts`, `validar/route.ts`, `confirmar/route.ts`.
- **UI**: `src/app/dashboard/colegio/cursos/carga/page.tsx` con tema verde, descarga de plantilla, input de archivo, resumen de validación y confirmación.
- **Auditoría**: se agregó `COLEGIO_CARGA_MASIVA` a `AuditLog` vía migración aditiva.
- **Tests**: `src/lib/colegio/carga/parser.test.ts`, `validator.test.ts`, `importer.test.ts`, `src/app/api/colegio/carga/route.test.ts`.
- **Validación**: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (678 tests verdes), `npm run build` y `./scripts/dev-restart.sh` (healthcheck ok, un worker).

## Status

CERRADA

