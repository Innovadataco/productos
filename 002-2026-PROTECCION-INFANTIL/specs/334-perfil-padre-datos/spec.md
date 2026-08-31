# Feature Specification: El padre registra los datos de su perfil

**Feature Branch**: `work/pi-SPEC-334-perfil-padre-datos`

**Created**: 2026-08-31

**Status**: DESARROLLO

**Input**: Prioridad CEO directa (2026-08-31). El perfil del padre no permite registrar sus datos: hoy `/dashboard/padre/perfil` es un placeholder y `Usuario` solo tiene `nombre`. El padre debe poder ver y editar sus 6 datos: nombres, apellidos, fecha de nacimiento, país, ciudad, teléfono.

**Impacto en arquitectura:** Migración aditiva a `Usuario` (nullable, sin backfill): `apellidos`, `fechaNacimiento`, `telefono`, `paisId` (FK `Pais`), `ciudadId` (FK `Ciudad`). "Nombres" reusa el `nombre` existente. Pantalla real `/dashboard/padre/perfil` (reemplaza el placeholder) + endpoint `GET/PATCH /api/padre/perfil` (DAL por repositorio). País/ciudad del catálogo geográfico existente vía `CiudadSearchSelect` (`permitirOtra=false`), país→ciudad dependientes. Usa el sistema de diseño existente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El padre registra y edita los datos de su perfil (Priority: P1)

Un padre entra a "Mi perfil", ve sus datos actuales, completa/edita los 6 campos (nombres, apellidos, fecha de nacimiento, país, ciudad, teléfono) y los guarda. Al recargar, los datos persisten.

**Why this priority**: Hoy el padre no puede registrar sus datos (pantalla placeholder + modelo sin campos). Es el bloqueo directo.

**Independent Test**: Entrar como padre a `/dashboard/padre/perfil`, llenar los 6 campos, guardar, recargar la página, verificar que los 6 persisten.

**Acceptance Scenarios**:

1. **Given** un padre autenticado, **When** abre `/dashboard/padre/perfil`, **Then** ve un formulario con nombres, apellidos, fecha de nacimiento, país, ciudad y teléfono (prellenados con lo que ya tenga).
2. **Given** el formulario, **When** el padre completa los 6 campos y guarda, **Then** el sistema confirma el guardado.
3. **Given** datos guardados, **When** el padre recarga la página, **Then** los 6 datos aparecen persistidos.
4. **Given** el campo ciudad, **When** el padre elige país y busca ciudad, **Then** la ciudad se elige del catálogo geográfico existente (dependiente del país), **sin** opción de texto libre "Otra ciudad".
5. **Given** la fecha de nacimiento, **When** el padre la ingresa, **Then** usa un selector de fecha claro (se guarda la fecha, no la edad).
6. **Given** el teléfono, **When** el padre lo deja vacío o con formato inválido, **Then** el sistema lo rechaza con un mensaje claro (validación mínima).

### Edge Cases

- **Padre sin datos previos** (cuentas viejas): el formulario aparece vacío/parcial y permite completar; no rompe.
- **Ciudad sin resultados**: como no hay "Otra ciudad", el padre refina la búsqueda; no se guarda texto libre.
- **País cambiado**: al cambiar país, la ciudad seleccionada se limpia/re-valida contra el nuevo país.
- **Guardado parcial**: el padre puede guardar aunque no complete todos los campos opcionales (solo el teléfono tiene validación de formato si se ingresa).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir una pantalla real `/dashboard/padre/perfil` (reemplaza el placeholder) que muestra los 6 datos del padre.
- **FR-002**: El padre DEBE poder editar y guardar: nombres, apellidos, fecha de nacimiento, país, ciudad, teléfono.
- **FR-003**: Los datos guardados DEBEN persistir (verificable al recargar).
- **FR-004**: País y ciudad DEBEN elegirse del catálogo geográfico existente, con la ciudad dependiente del país, **sin** texto libre "Otra ciudad".
- **FR-005**: La fecha de nacimiento DEBE capturarse con un selector de fecha claro (se guarda la fecha).
- **FR-006**: El teléfono DEBE tener validación mínima (no vacío / formato) cuando se ingresa.
- **FR-007**: El acceso a datos del padre DEBE ir por la capa DAL (repositorio), no Prisma directo en la ruta.

### Key Entities *(include if feature involves data)*

- **Usuario (padre)**: hoy `nombre`. Se agregan (aditivos, nullable): `apellidos`, `fechaNacimiento`, `telefono`, `paisId`, `ciudadId`. "Nombres" = `nombre`.
- **Pais / Ciudad** (catálogo existente, solo lectura): fuente de país/ciudad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un padre llena los 6 campos, guarda, recarga y los 6 persisten (0 pérdida).
- **SC-002**: País/ciudad se guardan del catálogo (0 texto libre).
- **SC-003**: La pantalla se ve bien y es usable en teléfono.

## Assumptions

- **Modelo en `Usuario` aditivo** (no tabla `PerfilPadre`): 5 campos nullable, decisión aprobada por el CEO.
- **"Nombres" = el `nombre` existente**; se agrega `apellidos` aparte.
- **`fechaNacimiento`** (no edad), aprobado por el CEO.
- **Reuso**: `CiudadSearchSelect` con `permitirOtra=false`; catálogo `Pais`/`Ciudad` existente.
- **DONE (candado 25, sin CI)**: prueba en el navegador — llenar 6, guardar, recargar, persisten; evidencia (captura/consulta BD) en el PR.
- **Fuera de alcance**: cambio de correo (queda para A-62 §3.4), notificaciones, resto de A-62 (pausado por el CEO).
- **Solo-lectura**: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`, motor de notificaciones.
