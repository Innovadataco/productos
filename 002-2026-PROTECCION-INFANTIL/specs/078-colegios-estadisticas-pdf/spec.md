# Feature Specification: Colegios · Fase 5 — Estadísticas e informe PDF institucional

**Feature Branch**: `feature/001-scaffolding`

**Spec**: `078-colegios-estadisticas-pdf`

**Created**: 2026-07-21

**Status**: CERRADA

**Input**: Fase 5 del módulo Colegios. Generar resumen agregado de cursos, alumnos, identificadores y alertas para el SCHOOL_ADMIN, y permitir descargar un informe PDF institucional con estética verde. No exponer reportes crudos ni PII ajenos.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El SCHOOL_ADMIN ve estadísticas agregadas de su colegio (Priority: P1)

El administrador institucional necesita una vista de estadísticas que muestre métricas propias del colegio: cantidad de cursos, alumnos, identificadores registrados y alertas recibidas, agrupadas por curso. La vista debe ser clara, accionable y nunca exponer datos crudos de reportes.

**Why this priority**: Es la funcionalidad principal de la fase: cerrar el ciclo de gestión institucional con indicadores agregados.

**Independent Test**: Un SCHOOL_ADMIN autenticado puede ver un resumen por curso de su colegio con conteos exactos y sin datos sensibles ajenos.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN con cursos, alumnos, identificadores y alertas, **When** accede a `/dashboard/colegio/estadisticas`, **Then** ve una tabla/tarjetas con: cursos totales, alumnos totales, identificadores totales, alertas totales y desglose por curso.
2. **Given** un curso con alumnos e identificadores, **When** se lista el desglose, **Then** se muestran: nombre del curso, cantidad de alumnos, cantidad de identificadores, cantidad de alertas.
3. **Given** un SCHOOL_ADMIN de un colegio sin cursos, **When** accede a estadísticas, **Then** ve el estado vacío con mensaje informativo y totalizadores en cero.
4. **Given** un SCHOOL_ADMIN autenticado, **When** consulta el endpoint de estadísticas, **Then** recibe solo datos de su colegio y código 200.

**Edge Cases**:
- Curso con alumnos pero sin identificadores: muestra 0 identificadores.
- Curso con identificadores pero sin alertas: muestra 0 alertas.
- Colegio con alertas de reportes dados de baja: esas alertas se excluyen del conteo.
- Alumnos inactivos: se incluyen en el conteo? Documentar decisión en plan (se propone incluir siempre, pero mostrar estado activo/inactivo si es relevante). Por simplicidad, contar todos los alumnos del curso.

---

### User Story 2 — El SCHOOL_ADMIN descarga un informe PDF institucional (Priority: P1)

El SCHOOL_ADMIN debe poder descargar un informe PDF con el resumen estadístico del colegio, con el estilo institucional verde (logo/emoticono, nombre del colegio, fecha de generación, tabla por curso). El PDF debe ser generado en el servidor y servido como descarga.

**Why this priority**: Entrega un artefacto tangible para gestión institucional y demuestra el patrón de exportación PDF reutilizable.

**Independent Test**: Un SCHOOL_ADMIN autenticado puede hacer clic en "Descargar PDF" y obtener un archivo PDF con el nombre del colegio, fecha y tabla de estadísticas por curso.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado en estadísticas, **When** hace clic en "Descargar PDF", **Then** se genera y descarga un archivo PDF con nombre `estadisticas-{colegio}-{fecha}.pdf`.
2. **Given** el PDF generado, **Then** incluye: nombre del colegio, fecha de generación, totales generales, tabla por curso con cursos, alumnos, identificadores y alertas.
3. **Given** un colegio sin cursos, **When** se genera el PDF, **Then** se incluye el encabezado, totales en cero y un mensaje de "sin datos".
4. **Given** un SCHOOL_ADMIN de otro colegio, **When** intenta acceder al endpoint de PDF de otro colegio, **Then** recibe 403/404.

**Edge Cases**:
- Nombre de colegio con caracteres especiales: el PDF debe renderizarlos correctamente (pdfmake con fuentes por defecto debería soportar UTF-8 básico; documentar si hay limitaciones).
- Muchos cursos: el PDF debe paginar correctamente.

---

## Edge Cases (generales)

- Un SCHOOL_ADMIN nunca debe ver estadísticas de otro colegio; todo filtrado por `colegioId`.
- No se exponen nombres de alumnos, identificadores ni textos de reportes en el PDF ni en la UI.
- Las alertas asociadas a reportes dados de baja se excluyen de los conteos.
- El PDF debe usar el tema verde institucional (mismo acento que `.theme-colegio`).
- Si el servicio del colegio está vencido, el proxy ya bloquea el acceso; no se requiere lógica adicional en este spec.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ofrecer un endpoint `GET /api/colegio/estadisticas` que devuelva un resumen agregado del colegio del SCHOOL_ADMIN autenticado.
- **FR-002**: El resumen DEBE incluir: total de cursos, total de alumnos, total de identificadores, total de alertas, y desglose por curso (nombre, alumnos, identificadores, alertas).
- **FR-003**: El sistema DEBE filtrar toda la información por el `colegioId` del usuario autenticado; nunca exponer datos de otro colegio.
- **FR-004**: El sistema DEBE excluir del conteo de alertas aquellas cuyo reporte esté eliminado o dado de baja.
- **FR-005**: El sistema DEBE ofrecer un endpoint `GET /api/colegio/estadisticas/pdf` que genere y descargue un PDF con el resumen estadístico.
- **FR-006**: El PDF DEBE incluir el nombre del colegio, fecha de generación, totales generales y tabla por curso con cursos, alumnos, identificadores y alertas.
- **FR-007**: El PDF DEBE aplicar el estilo verde institucional (color de acento #10b981 o el token de la paleta colegio).
- **FR-008**: El sistema DEBE mostrar la vista de estadísticas en `/dashboard/colegio/estadisticas`, reemplazando el placeholder actual, con tema verde y navegación colegio.
- **FR-009**: La UI DEBE mostrar un botón claro para descargar el PDF.
- **FR-010**: El sistema DEBE registrar auditoría `COLEGIO_ESTADISTICAS_PDF_DESCARGADO` cuando se descargue el PDF.
- **FR-011**: El sistema NO DEBE exponer en la UI ni en el PDF: textos de reportes, nombres de alumnos, valores de identificadores, ni datos del denunciante.
- **FR-012**: El sistema DEBE tener tests de integración para el endpoint de estadísticas y el endpoint de PDF.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las estadísticas devueltas pertenecen al colegio del SCHOOL_ADMIN; tests de aislamiento pasan.
- **SC-002**: El PDF se genera correctamente y contiene los totales y el desglose por curso.
- **SC-003**: La UI muestra el botón de descarga y la tabla/tarjetas de estadísticas.
- **SC-004**: Todos los endpoints de Fase 5 tienen tests de integración.
- **SC-005**: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npx vitest run` pasan sin errores.
- **SC-006**: Deploy limpio con `./scripts/dev-restart.sh` y healthcheck ok.

---

## Assumptions

- La Fase 4 (spec 077) está cerrada con `AlertaColegio`, `Curso`, `Alumno` e `IdentificadorAlumno` operativos.
- El SCHOOL_ADMIN tiene un único colegio asociado (`Usuario.colegioId`).
- No se requiere persistir las estadísticas en una tabla; se calculan en tiempo real.
- No se requiere gráficas ni exportación a Excel en esta fase (solo PDF).
- El modelo `Reporte` y el worker no se modifican en esta fase.
- Se usará la librería `pdfmake` para generación de PDF en el servidor (Node runtime).

---

## Implementación

### Resumen

Se implementó la Fase 5 del módulo Colegios: estadísticas agregadas por curso e informe PDF institucional con estética verde, accesible solo para el SCHOOL_ADMIN de cada colegio.

### Decisiones técnicas

- **Cálculo en tiempo real**: no se agregaron tablas de estadísticas. Las métricas se calculan con consultas a `Curso`, `Alumno`, `IdentificadorAlumno` y `AlertaColegio`, filtradas por `colegioId`.
- **Privacidad**: la UI y el PDF solo muestran conteos agregados por curso. No se exponen nombres de alumnos, valores de identificadores, texto de reportes ni PII de denunciantes.
- **PDF**: se eligió `pdfmake` para generación de PDF en el servidor. El route handler declara `runtime = "nodejs"`. Se forzó el modo Node pasando las fuentes virtuales (`vfs`) como argumento a `createPdf`, de modo que funcione incluso en entornos con `window` (jsdom).
- **Auditoría**: se agregó el valor `COLEGIO_ESTADISTICAS_PDF_DESCARGADO` al enum `AccionAudit` vía migración aditiva.
- **Aislamiento**: cada endpoint verifica `verifyAuth("SCHOOL_ADMIN")` y la vigencia del colegio, y usa `user.colegioId` para filtrar todos los datos.
- **Alertas excluidas**: los conteos de alertas omiten reportes `eliminado=true` o cuyo estado no esté en la lista de estados visibles (`src/lib/colegio/alertas.ts`).

### Archivos modificados/creados

- `prisma/schema.prisma`
- `prisma/migrations/20260721_add_colegio_estadisticas_pdf_audit/migration.sql`
- `src/lib/colegio/estadisticas.ts`
- `src/lib/colegio/pdf-estadisticas.ts`
- `src/app/api/colegio/estadisticas/route.ts`
- `src/app/api/colegio/estadisticas/pdf/route.ts`
- `src/app/api/colegio/estadisticas/route.test.ts`
- `src/app/dashboard/colegio/estadisticas/page.tsx`
- `src/app/dashboard/colegio/page.tsx`
- `package.json` (dependencia `pdfmake` y `@types/pdfmake`)
- `specs/078-colegios-estadisticas-pdf/spec.md`
- `specs/078-colegios-estadisticas-pdf/cierre.md`

### Pruebas y validación

- `npx tsc --noEmit`: sin errores.
- `npm run lint`: sin errores.
- `npx vitest run`: 711 tests verdes (≥ 704).
- `npm run build`: exitoso.
- `./scripts/dev-restart.sh`: deploy limpio con healthcheck OK y un solo worker.
- Quickstart probado: carga de estadísticas vía `/api/colegio/estadisticas`, descarga de PDF vía `/api/colegio/estadisticas/pdf`, verificación de aislamiento y de la UI en `/dashboard/colegio/estadisticas`.

### Deuda técnica

- El PDF usa `pdfmake` con tipos forzados (`as unknown`) para compatibilidad con jsdom y Node. A futuro se puede evaluar `pdfkit` si el volumen de PDFs crece o se requieren diseños más complejos.
- No se incluyen gráficas ni exportación a Excel en esta fase.
- La generación de PDF es síncrona en el request; para volúmenes altos se podría mover a un job en background.

### Commits

Ver `git log` en evidencia de cierre.
