# Feature Specification: SPEC-153 — Comparativa entre cursos

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-10

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-058, brief §10. El rector necesita comparar cursos de su colegio (por grado o año lectivo) para identificar concentraciones de riesgo y tomar decisiones institucionales con datos agregados, sin exponer PII.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver comparativa agregada de cursos (Priority: P1)

Como SCHOOL_ADMIN, quiero ver una comparativa de todos los cursos de mi colegio agrupados por grado o año lectivo, para detectar patrones sin ver datos individuales.

**Why this priority**: Es la entrega central de la spec y habilita decisiones basadas en datos agregados.

**Independent Test**: un SCHOOL_ADMIN con 3 cursos (dos del mismo grado, uno de otro) llama `GET /api/colegio/analisis/comparativa?agruparPor=grado` y recibe dos grupos con conteos de cursos, estudiantes, identificadores y alertas visibles; un ADMIN recibe 403.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN con cursos en su colegio, **When** accede a `/dashboard/colegio/analisis/comparativa`, **Then** ve una tabla con grupos, conteos y promedios por curso.
2. **Given** la comparativa, **Then** no expone nombres de estudiantes, identificadores ni contenido de reportes.
3. **Given** un ADMIN u otro rol, **When** llama al endpoint, **Then** recibe 403.
4. **Given** un colegio sin cursos, **Then** la respuesta indica estado vacío sin errores.

---

### User Story 2 — Cambiar criterio de agrupación (Priority: P1)

Como SCHOOL_ADMIN, quiero alternar entre agrupar por grado y por año lectivo, para analizar la misma información desde dos perspectivas.

**Why this priority**: Permite análisis temporal y por nivel educativo.

**Independent Test**: el endpoint acepta `agruparPor=grado` (default) y `agruparPor=anioLectivo`, y devuelve grupos distintos según el criterio.

**Acceptance Scenarios**:

1. **Given** cursos del mismo grado pero años distintos, **When** agrupo por grado, **Then** aparecen en un solo grupo.
2. **Given** los mismos cursos, **When** agrupo por año lectivo, **Then** aparecen en grupos separados.
3. **Given** un valor inválido de `agruparPor`, **Then** devuelve 400 con mensaje humano.

---

### User Story 3 — Exportar comparativa a Excel (Priority: P2)

Como SCHOOL_ADMIN, quiero descargar la comparativa en Excel para compartirla en reuniones institucionales.

**Why this priority**: Soporte a la gobernanza escolar y documentación de decisiones.

**Independent Test**: `GET /api/colegio/analisis/comparativa/excel?agruparPor=grado` devuelve un archivo `.xlsx` no vacío con las mismas columnas que la tabla de la UI.

**Acceptance Scenarios**:

1. **Given** la comparativa lista, **When** hago clic en "Exportar Excel", **Then** se descarga un archivo `.xlsx` con nombre `comparativa-cursos-<colegio>-<criterio>.xlsx`.
2. **Given** el archivo descargado, **Then** contiene una hoja con las columnas: Grupo, Cursos, Estudiantes, Identificadores, Alertas, Promedio estudiantes/curso.
3. **Given** un ADMIN, **When** intenta descargar, **Then** recibe 403.

## Edge Cases

- **Sin cursos**: respuesta vacía con totales en cero; Excel tiene solo encabezados.
- **Cursos inactivos**: no se incluyen en la comparativa (igual que estadísticas generales).
- **Estudiantes/identificadores inactivos**: no se cuentan.
- **Alertas de reportes dados de baja o no visibles**: no se cuentan.
- **Criterio desconocido**: 400 con mensaje humano.
- **Colegio no vigente**: 403 con mensaje de vigencia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Endpoint `GET /api/colegio/analisis/comparativa?agruparPor=grado|anioLectivo` para `SCHOOL_ADMIN`.
- **FR-002**: Endpoint `GET /api/colegio/analisis/comparativa/excel?agruparPor=grado|anioLectivo` para descargar Excel.
- **FR-003**: Tenant-first: solo se consultan cursos del `colegioId` del usuario autenticado.
- **FR-004**: Agrupación en memoria a partir de `calcularEstadisticasColegio` (o query equivalente tenant-first), sin exponer PII.
- **FR-005**: Métricas por grupo: cantidad de cursos, estudiantes, identificadores, alertas visibles y promedio de estudiantes por curso.
- **FR-006**: Validación de `agruparPor`; default `grado`.
- **FR-007**: UI en `/dashboard/colegio/analisis/comparativa` con selector de criterio, tabla y botón de exportación.
- **FR-008**: Rate limit `admin_read` en ambos endpoints.
- **FR-009**: No se toca `src/lib/ai/**`; `arch:check` y `tokens:check` verdes.
- **FR-010**: Tests de integración: JSON agrupado, Excel no vacío, 403 para ADMIN, 400 por criterio inválido.

### Key Entities

- **ComparativaInput**: `{ agruparPor: "grado" | "anioLectivo" }`.
- **ComparativaGrupo**: `{ grupo: string; cursos: number; estudiantes: number; identificadores: number; alertas: number; promedioEstudiantes: number; }`.
- **ComparativaResultado**: `{ colegioId: string; colegioNombre: string; agruparPor: string; grupos: ComparativaGrupo[]; totales: { cursos; estudiantes; identificadores; alertas } }`.

## Success Criteria *(mandatory)*

- **SC-001**: SCHOOL_ADMIN obtiene comparativa agrupada sin PII.
- **SC-002**: Cambio de criterio de agrupación devuelve grupos distintos.
- **SC-003**: Excel descargable contiene los mismos datos que la UI.
- **SC-004**: ADMIN y otros roles reciben 403.
- **SC-005**: `tsc`, `lint`, `tokens:check`, `arch:check`, `test:coverage` y `build` verdes.

## Assumptions

- Se reutiliza `calcularEstadisticasColegio` como fuente de datos agregados por curso.
- Los cursos inactivos se excluyen (el repositorio ya filtra activos).
- El Excel se genera con `exceljs` (ya es dependencia del proyecto).
- La UI reutiliza componentes de tabla y botón existentes.

## Impacto en arquitectura:

Añade dos endpoints (`/api/colegio/analisis/comparativa` y `/excel`), servicio de comparativa, utilidad de export Excel, página `/dashboard/colegio/analisis/comparativa` y actualización de la matriz de roles/capacidades. No modifica el modelo de datos. No toca el motor de IA.

## Implementación

- **Backend**: `src/lib/colegio/comparativa.ts` calcula la comparativa agrupada por `grado` o `anioLectivo` reutilizando `calcularEstadisticasColegio`. `src/lib/schemas/comparativa.ts` valida el criterio con Zod. Endpoints: `GET /api/colegio/analisis/comparativa` (JSON) y `GET /api/colegio/analisis/comparativa/excel` (descarga Excel vía `exceljs`).
- **Excel**: `src/lib/colegio/export-comparativa-excel.ts` genera un `.xlsx` determinista, sin fórmulas ni macros, con columnas: Grupo, Cursos, Estudiantes, Identificadores, Alertas, Promedio estudiantes/curso.
- **Audit**: la descarga de Excel registra `COLEGIO_COMPARATIVA_EXCEL_DESCARGADO` en `AuditLog`.
- **UI**: `src/app/dashboard/colegio/analisis/comparativa/page.tsx` expone selector de criterio, tabla resumen, totales y botón de exportación.
- **Tests**: `src/app/api/colegio/analisis/comparativa/route.test.ts` y `src/app/api/colegio/analisis/comparativa/excel/route.test.ts` cubren agrupación, cambio de criterio, PII, 403 para ADMIN y 400 por criterio inválido.
- **Arquitectura**: se regeneraron `docs/architecture/02-roles-capacidades.md` y `docs/architecture/03-pantallas.md` para reflejar la nueva ruta y capacidad.
- **No se tocó** `src/lib/ai/**`.
