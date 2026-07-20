# Feature Specification: Claridad y estados

**Feature Branch**: `feature/001-scaffolding`

**Spec ID**: 051-claridad-estados

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: "PROGRAMA DE SANEAMIENTO — Mejoras de claridad, estados vacíos/error y jerarquía visual en interfaces densas."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Componente estándar de estado vacío/error accionable (Priority: P1)

El sistema actual muestra mensajes aislados como *"Error al cargar…"* o *"No se pudo cargar…"* sin una forma consistente de reintentar o entender qué ocurrió. Se requiere un componente visual estándar para estados vacíos y de error que sea accionable, accesible y reutilizable en todas las pantallas.

**Why this priority**: Los mensajes de error sueltos degradan la confianza del usuario, especialmente en un contexto sensible. Un componente estándar reduce la inconsistencia y permite recuperarse de errores de carga.

**Independent Test**: Un usuario que reciba un error de carga ve un mensaje claro, una explicación breve y un botón para reintentar; un usuario que encuentre una lista vacía ve un mensaje contextual y, cuando aplica, una acción siguiente.

**Acceptance Scenarios**:

1. **Given** que una pantalla falla al cargar datos, **When** se renderiza el estado de error, **Then** el sistema muestra el componente `ErrorState` con título, descripción y botón de reintentar.
2. **Given** que una lista o tabla no tiene resultados, **When** se renderiza el estado vacío, **Then** el sistema muestra el componente `EmptyState` con título contextual y descripción orientadora.
3. **Given** un desarrollador que necesita usar el componente, **When** importa `EmptyState` o `ErrorState`, **Then** puede personalizar título, descripción, acción y callback de reintento sin duplicar estilos.

---

### User Story 2 — Microcopy empático para el contexto emocional (Priority: P2)

Los flujos de denuncia y consulta manejan información sensible. El copy actual es funcional pero puede sentirse frío o técnico. Se debe revisar el texto de reportes, consulta y seguimiento para que sea claro, respetuoso, no culpante y orientado a la seguridad del usuario.

**Why this priority**: Un microcopy empático reduce la ansiedad del usuario, refuerza la confianza en la plataforma y evita lenguaje que pueda interpretarse como veredicto o culpabilización.

**Independent Test**: Un usuario nuevo puede completar el reporte y la consulta entendiendo cada paso sin sentirse juzgado ni confundido por términos técnicos.

**Acceptance Scenarios**:

1. **Given** un usuario en el formulario de reporte, **When** lee los títulos y ayudas, **Then** el lenguaje es descriptivo, evita etiquetas de culpabilidad y recuerda que el reporte no reemplaza la denuncia formal.
2. **Given** un usuario en la consulta pública, **When** no hay reportes para el identificador, **Then** el mensaje explica de forma neutral que no hay reportes suficientes y ofrece una acción siguiente.
3. **Given** un usuario en seguimiento de reporte, **When** ingresa un número incorrecto o hay error de conexión, **Then** el mensaje indica con claridad cómo corregirlo sin alarmismo.

---

### User Story 3 — Jerarquía visual en pantallas densas (Priority: P3)

Las pantallas de operador, comité de validación y administrador contienen tablas, formularios, resúmenes y acciones amontonados. Mejorar la jerarquía visual con encabezados de sección, separación de tarjetas y ritmo de espacios facilita la navegación y reduce la carga cognitiva.

**Why this priority**: Pantallas densas son propensas a errores de operación. Una jerarquía visual clara ayuda a identificar rápidamente la información importante sin rediseñar los flujos existentes.

**Independent Test**: Un operador/administrador puede, en una pantalla densa, distinguir el título de página, las secciones de resumen, el listado y el formulario sin esfuerzo adicional.

**Acceptance Scenarios**:

1. **Given** un administrador en el dashboard de administración, **When** la página carga, **Then** los títulos de sección, tarjetas de métricas y gráficos tienen espaciado y encabezados consistentes.
2. **Given** un administrador en la gestión de operadores o comité, **When** la página carga, **Then** cada bloque (resumen, formulario, listado) tiene un encabezado visual claro y separación entre ellos.
3. **Given** un operador en la asignación de casos, **When** la página carga, **Then** el estado de la cola, las métricas y la tabla de operadores se presentan con jerarquía visual coherente.

---

## Edge Cases

- El componente de error debe funcionar sin conexión a internet (mostrar mensaje apropiado si `window` no tiene red).
- El estado vacío debe diferenciar entre "sin datos porque no hay registros" y "sin resultados por filtros aplicados".
- El microcopy debe mantenerse neutral cuando la consulta retorna riesgo alto; evitar alarmismo.
- La jerarquía visual no debe ocultar información ni reducir densidad en exceso; el objetivo es claridad, no simplificación.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-051-001**: El sistema DEBE proporcionar un componente `ErrorState` reutilizable con título, descripción y botón de acción (por defecto "Reintentar").
- **FR-051-002**: El sistema DEBE proporcionar un componente `EmptyState` reutilizable con título, descripción y acción opcional.
- **FR-051-003**: El sistema DEBE reemplazar los mensajes sueltos *"Error al cargar…"*, *"No se pudo cargar…"* y *"No se encontró…"* por el componente `ErrorState`.
- **FR-051-004**: El sistema DEBE usar el componente `EmptyState` en listados y tablas que no tengan resultados.
- **FR-051-005**: El microcopy de los flujos de reporte, consulta y seguimiento DEBE ser claro, respetuoso y no culpante.
- **FR-051-006**: El formulario de reporte DEBE recordar al usuario que el reporte es informativo y no reemplaza una denuncia formal ante autoridades.
- **FR-051-007**: Los mensajes de consulta pública DEBEN describir resultados en términos agregados ("N reportes registrados") sin emitir juicios de valor.
- **FR-051-008**: Las pantallas de operador, comité y administrador DEBEN tener encabezados de sección y separación visual consistente.
- **FR-051-009**: El sistema DEBE mantener los flujos de interacción existentes; no se deben rediseñar ni alterar reglas de negocio.

### Key Entities

- No hay cambios en el modelo de datos. Los componentes y ajustes de copy son puramente de presentación.

---

## Success Criteria *(mandatory)*

- **SC-051-001**: El 100% de los mensajes de error de carga visibles al usuario usan el componente `ErrorState` con acción de reintento.
- **SC-051-002**: Al menos el 80% de los listados/tablas vacíos usan el componente `EmptyState` con copy contextual.
- **SC-051-003**: El copy de reporte, consulta y seguimiento no contiene lenguaje culpante o alarmista; pasa revisión contra la constitución §1.3.
- **SC-051-004**: Las pantallas de operador, comité y administrador presentan títulos de sección y separación visual consistente sin pérdida de información.
- **SC-051-005**: `npm run lint`, `tsc --noEmit`, `npm run test` y `npm run build` pasan sin errores introducidos por este spec.

---

## Assumptions

- No se requieren nuevos endpoints ni migraciones de base de datos.
- El stack es Next.js 16 + React 19 + TypeScript strict + Tailwind CSS 3.4.
- Los componentes deben ubicarse en `src/components/ui/` para reutilización.
- Las pantallas afectadas son puramente frontend; no se modifica lógica de autenticación ni permisos.
- Los cambios de copy son localizados a español (es-CO) y no requieren internacionalización adicional en este spec.

---

## Implementación (documentado el 2026-07-20)

### Objetivo alcanzado
Entregar componentes de estado vacío/error reutilizables, mejorar el microcopy en flujos sensibles y clarificar la jerarquía visual de pantallas densas sin modificar flujos ni datos.

### Decisiones de diseño derivadas del código
- **Componentes centralizados**: `src/components/ui/EmptyState.tsx` y `src/components/ui/ErrorState.tsx` concentran la presentación de estados informativos y de error, con acción opcional y reintento.
- **Reemplazo progresivo**: Se reemplazaron los mensajes sueltos "Error al cargar…", "No se pudo cargar…" y "No se encontró…" por `ErrorState`, y los estados vacíos de listas y tablas por `EmptyState`.
- **Microcopy empático**: El lenguaje de reporte, consulta y seguimiento se ajustó para ser descriptivo, no culpante y orientado a la acción, manteniendo la distinción "reporte informativo vs denuncia formal" y los canales oficiales.
- **Jerarquía visual sin rediseño**: En `AdminDashboard`, `AdminOperadoresAsignarPage`, `AdminOperadoresGestionPage` y `GestionPageClient` se añadieron encabezados de sección (`aria-labelledby`) y separación coherente entre resumen, formulario y listado.

### Componentes y páginas afectados
- `src/components/ui/EmptyState.tsx` y `src/components/ui/ErrorState.tsx` (nuevos, con tests).
- Estados de error: `mis-reportes/page.tsx`, `DashboardUsuarioClient.tsx`, `ComiteSolicitudDetalle.tsx`, `AdminReporteDetalle.tsx`, `AdminReportesTable.tsx`, `IaEvalManager.tsx`, `AdminDashboard.tsx`, `PublicDashboard.tsx`, `ConsultaPublicaClient.tsx`, `SeguimientoClient.tsx`, `ComiteBandeja.tsx`, `SpamRevisionPanel.tsx`, `AdminAntiAbusoSimulacion.tsx`, `AuditLogViewer.tsx`, `IaDocsPanel.tsx`, `AdminOperadoresAsignarPage`.
- Microcopy: `reportar/page.tsx`, `ReporteStepPlataforma.tsx`, `ReporteStepDetalle.tsx`, `ReporteStepDescripcion.tsx`, `ReporteStepConfirmar.tsx`, `ConfirmacionReporte.tsx`, `ConsultaForm.tsx`, `ConsultaPublicaClient.tsx`, `SeguimientoForm.tsx`, `SeguimientoClient.tsx`.
- Jerarquía visual: `AdminDashboard.tsx`, `AdminOperadoresAsignarPage`, `AdminOperadoresGestionPage`, `GestionPageClient.tsx`.
- Tests ajustados: `ConsultaPublicaClient.test.tsx`, `ReporteWizard.test.tsx`, `SeguimientoClient.test.tsx`.

### Validación
- `npx tsc --noEmit`: sin errores.
- `npm run lint`: sin errores (0 problemas).
- `npm run test`: 94 archivos, 540 tests pasados.
- `npm run build`: exitoso.
- `./scripts/dev-restart.sh`: healthcheck `{"status":"ok","workerAlive":true,"dbOk":true}`.
- Quickstart manual: login como ADMIN, parámetros públicos, consulta sin reportes y páginas `/reportar`, `/consulta`, `/seguimiento` responden con el nuevo copy.

### Migraciones
Ninguna. El spec no modificó el modelo de datos.

### Deuda técnica
- Algunos listados y tablas vacías aún no usan `EmptyState` (p. ej. `dataset-entrenamiento`, `circulo-confianza`, `ConfigPanel`). Están fuera del alcance de este spec y pueden migrarse progresivamente.
- El icono de `EmptyState`/`ErrorState` es inline SVG. Si en el futuro se adopta una librería de iconos, se puede centralizar en un componente `Icon` sin cambiar la API pública.
- El retry de `ErrorState` usa recarga o re-llamada manual; un patrón de Suspense/Error Boundary global podría estandarizar esto más adelante.

