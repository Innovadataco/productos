# Feature Specification: SPEC-164 — Identificadores de profesor + profesores en estadísticas

**Feature Branch**: `work/002-pi-062`

**Created**: 2026-08-12

**Status**: IMPLEMENTADO

**Input**: [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §4.1 (eje profesor con identificadores) y §6 (KPIs/profesores en Inicio y Estadísticas). Fuentes vinculantes: SPEC-145 (modelo Profesor), SPEC-134 (tenant-first / DAL E-1), SPEC-077/139 (matching de alertas, preparación para Fase C).

**Aclaración terminológica**: sigue el patrón de `IdentificadorEstudiante`: un profesor puede tener N identificadores (teléfono, email, nick, usuario en plataforma), pero cada fila de `IdentificadorProfesor` pertenece a un único profesor. La relación "N:M" del brief se refiere a que un profesor puede tener muchos identificadores y, a futuro (Fase C), un mismo identificador puede generar alertas para el colegio.

## Impacto en arquitectura:

- **Modelo de datos**: migración aditiva que añade la tabla `IdentificadorProfesor` (FK a `Profesor`, `Colegio` y `Plataforma`), siguiendo el patrón de `IdentificadorEstudiante`.
- **API/UI**: endpoints REST y ficha de profesor para gestionar identificadores; KPIs de Inicio y Estadísticas incluyen cobertura de profesores.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rector registra identificadores de un profesor (Priority: P1)

Como rector (`SCHOOL_ADMIN`) quiero agregar teléfonos, emails o usuarios de plataforma a un profesor, para que el sistema pueda cruzarlos con reportes futuros.

**Why this priority**: cierra la primera mitad del eje profesor del brief §4.1; sin identificadores registrados no hay alertas posibles sobre profesores (Fase C).

**Independent Test**: un rector puede abrir la ficha de un profesor, agregar dos identificadores de distinto tipo y plataforma, y verlos listados; otro rector no ve ni modifica los identificadores ajenos.

**Acceptance Scenarios**:

1. **Given** un rector autenticado y un profesor activo de su colegio, **When** envía `POST /api/colegio/profesores/[id]/identificadores` con `valor` y opcionalmente `tipo`/`plataformaId`, **Then** se crea el identificador, se normaliza el valor y se audita `COLEGIO_IDENTIFICADOR_PROFESOR_CREADO`.
2. **Given** un rector, **When** envía el mismo `valor`+`tipo`+`plataformaId` dos veces para el mismo profesor, **Then** la segunda recibe `409` con mensaje claro.
3. **Given** un rector, **When** omite el `tipo`, **Then** el sistema infiere el tipo desde el valor (teléfono, email o genérico) antes de guardar.
4. **Given** un rector de otro colegio, **When** intenta leer o crear identificadores en un profesor ajeno, **Then** recibe `404` sin tocar nada (A/B).
5. **Given** un rector, **When** envía `plataformaId`, **Then** se valida que exista; si no, devuelve `404`.

---

### User Story 2 — Rector gestiona identificadores en la ficha del profesor (Priority: P1)

Como rector quiero ver, editar y desactivar los identificadores de un profesor desde su ficha, manteniendo un historial de bajas sin borrar datos.

**Why this priority**: la ficha es el lugar natural de mantenimiento del profesor; reutiliza el patrón de la ficha del estudiante (SPEC-144/147).

**Independent Test**: un rector puede listar, editar el valor/tipo/plataforma, desactivar y reactivar identificadores; las bajas son soft delete y se reflejan en el listado.

**Acceptance Scenarios**:

1. **Given** la ficha de un profesor, **When** se abre, **Then** se muestran sus identificadores activos con tipo, valor, plataforma y estado.
2. **Given** un identificador existente, **When** el rector edita su valor en `PATCH /api/colegio/identificadores-profesor/[id]`, **Then** se valida que no genere duplicado y se audita `COLEGIO_IDENTIFICADOR_PROFESOR_EDITADO`.
3. **Given** un identificador activo, **When** el rector envía `PATCH /api/colegio/identificadores-profesor/[id]/estado` con `inactivo`, **Then** el identificador queda inactivo (soft delete) y se audita `COLEGIO_IDENTIFICADOR_PROFESOR_DESACTIVADO`.
4. **Given** un identificador inactivo, **When** el rector lo reactiva, **Then** vuelve a estar activo y puede usarse para futuras alertas.
5. **Given** un profesor inactivo, **When** se intenta agregar un identificador, **Then** se recibe `400` (no se enriquece un profesor dado de baja).

---

### User Story 3 — Colegio ve conteo de profesores en home y estadísticas (Priority: P2)

Como rector quiero ver cuántos profesores activos tiene mi colegio tanto en la home operativa como en la pantalla de estadísticas, junto a los demás KPIs.

**Why this priority**: el brief §6 incluye explícitamente "profesores" en los KPIs de Inicio y "+ conteo de profesores" en Estadísticas.

**Independent Test**: la home muestra el número de profesores activos; la pantalla de estadísticas incluye una tarjeta de profesores en los totales.

**Acceptance Scenarios**:

1. **Given** la home del rector (`/dashboard/colegio`), **When** carga, **Then** el KPI de profesores refleja el conteo de profesores activos del colegio.
2. **Given** la pantalla de estadísticas (`/dashboard/colegio/estadisticas`), **When** carga, **Then** los totales incluyen una tarjeta "Profesores" con el conteo activo.
3. **Given** un cambio de estado de un profesor, **When** se recarga la home o estadísticas, **Then** el conteo se actualiza (profesores inactivos no suman).
4. **Given** un rector de otro colegio, **When** consulta home/estadísticas, **Then** el conteo es del colegio propio (A/B).

---

### Edge Cases

- **Profesor inactivo**: no se permiten altas ni ediciones de identificadores; los identificadores históricos se conservan y se muestran como inactivos.
- **Duplicados**: `@@unique([profesorId, valor, tipo, plataformaId])` evita repetir el mismo identificador para un profesor.
- **Cross-tenant**: todo acceso a identificadores viaja por `profesor.colegioId`; un identificador ajeno devuelve `404`.
- **Soft delete**: `IdentificadorProfesor.estado` es `activo`/`inactivo`; nunca se borra físicamente.
- **Tipo inferido**: si no se envía `tipo`, se infiere del valor (teléfono E.164, email o genérico), igual que en `IdentificadorEstudiante`.
- **Plataforma opcional**: `plataformaId` puede ser `null` para identificadores genéricos.
- **Ficha sin identificadores**: se muestra empty state con acción para agregar.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir el modelo `IdentificadorProfesor` como tabla hija de `Profesor`, con los campos `tipo`, `valor`, `plataformaId` y `estado`.
- **FR-002**: El sistema DEBE permitir al `SCHOOL_ADMIN` crear identificadores de un profesor propio de su colegio vía `POST /api/colegio/profesores/[id]/identificadores`.
- **FR-003**: El sistema DEBE permitir al `SCHOOL_ADMIN` listar los identificadores de un profesor propio vía `GET /api/colegio/profesores/[id]/identificadores`.
- **FR-004**: El sistema DEBE permitir al `SCHOOL_ADMIN` editar un identificador propio vía `PATCH /api/colegio/identificadores-profesor/[id]`.
- **FR-005**: El sistema DEBE permitir al `SCHOOL_ADMIN` cambiar el estado de un identificador propio vía `PATCH /api/colegio/identificadores-profesor/[id]/estado`.
- **FR-006**: El sistema DEBE inferir el `tipo` del identificador cuando no se envía explícitamente.
- **FR-007**: El sistema DEBE validar que `profesorId` y `plataformaId` (si aplica) pertenezcan al mismo `colegioId`.
- **FR-008**: El sistema DEBE evitar duplicados de `(profesorId, valor, tipo, plataformaId)`.
- **FR-009**: El sistema NO DEBE permitir modificar `Curso` ni `Estudiante.cursoId`.
- **FR-010**: El sistema DEBE mantener el KPI `profesores` en la home del rector (conteo de activos).
- **FR-011**: El sistema DEBE añadir el conteo de profesores activos a la pantalla de estadísticas.
- **FR-012**: El sistema DEBE auditar las mutaciones sobre `IdentificadorProfesor`.
- **FR-013**: El sistema DEBE mostrar la gestión de identificadores en la ficha del profesor (`/dashboard/colegio/profesores/[id]`).

### Key Entities

- **IdentificadorProfesor**: identificador asociado a un profesor. Atributos: `id`, `profesorId`, `tipo`, `valor`, `plataformaId`, `estado` (activo/inactivo), `createdAt`, `updatedAt`.
- **Profesor**: sin cambios en sus campos; adquiere relación `1:N` con `IdentificadorProfesor`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un rector puede crear, listar, editar, desactivar y reactivar identificadores de un profesor de su colegio.
- **SC-002**: El 100% de las operaciones sobre `IdentificadorProfesor` respetan el aislamiento por `colegioId`.
- **SC-003**: No se permiten duplicados de identificador para el mismo profesor.
- **SC-004**: La home del rector muestra el conteo actualizado de profesores activos.
- **SC-005**: La pantalla de estadísticas muestra una tarjeta de profesores activos.
- **SC-006**: Cada mutación de identificador de profesor genera un `AuditLog` inmutable.
- **SC-007**: La migración de BD es aditiva: crea `IdentificadorProfesor`; no modifica `Curso`, `Estudiante` ni `Profesor`.

---

## Impacto en arquitectura

- **Modelo de datos**: se añade la tabla `IdentificadorProfesor` con FK a `Profesor` y `Plataforma`; migración aditiva.
- **DAL**: nuevo `IdentificadorProfesorRepository` (patrón tenant-first SPEC-134) con tests.
- **API**: endpoints bajo `/api/colegio/profesores/[id]/identificadores` y `/api/colegio/identificadores-profesor/[id]`/ `[id]/estado`, con validación Zod y rate limiting.
- **UI**: nueva página/ficha `/dashboard/colegio/profesores/[id]` para ver y gestionar identificadores; se añade enlace desde la lista de profesores.
- **Estadísticas**: se actualiza `calcularEstadisticasColegio` para incluir conteo de profesores activos y el cliente de estadísticas para mostrar la tarjeta.
- **Auditoría**: acciones `COLEGIO_IDENTIFICADOR_PROFESOR_CREADO`, `COLEGIO_IDENTIFICADOR_PROFESOR_EDITADO`, `COLEGIO_IDENTIFICADOR_PROFESOR_DESACTIVADO` en `AccionAudit`.
- **Arquitectura**: la línea base generada (`docs/architecture/`) se regenera para reflejar tabla, rutas y pantalla nuevas.

---

## Assumptions

- `Profesor` no cambia de esquema; solo adquiere una relación hacia `IdentificadorProfesor`.
- `IdentificadorProfesor` sigue el mismo patrón de normalización/validación que `IdentificadorEstudiante`.
- `SCHOOL_ADMIN` es el único rol que administra identificadores de profesores.
- No se requiere eliminación física de identificadores; la baja es soft delete por `estado`.
- El conteo de profesores en home/estadísticas cuenta solo profesores con `estado = "activo"`.
- La ficha del profesor es nueva: hoy la lista de profesores edita inline; esta spec la crea para alojar los identificadores.

---

## Implementación

- **Modelo de datos**: migración aditiva `prisma/migrations/20260812113000_spec_164_identificador_profesor/` crea `IdentificadorProfesor` con FKs a `Profesor`, `Colegio` y `Plataforma`; se añaden valores de `AccionAudit` para operaciones de identificador de profesor.
- **DAL**: `src/lib/dal/repositories/identificador-profesor.ts` con CRUD tenant-first, duplicados, validación de profesor activo y búsqueda cross-tenant (`buscarActivosPorValor`); tests en `identificador-profesor.test.ts`.
- **Permisos**: `src/lib/colegio/permisos.ts` añade `verificarPropiedadProfesor` e `verificarPropiedadIdentificadorProfesor`.
- **API**:
  - `GET/POST /api/colegio/profesores/[id]/identificadores` con validación Zod, normalización/inferencia de tipo, duplicados y auditoría.
  - `PATCH /api/colegio/identificadores-profesor/[id]` y `PATCH /api/colegio/identificadores-profesor/[id]/estado` con propiedad por tenant y auditoría.
  - Tests en `src/app/api/colegio/profesores/[id]/identificadores/route.test.ts`.
- **UI**:
  - `src/app/dashboard/colegio/profesores/[id]/page.tsx` + `ProfesorDetallePageClient.tsx`: ficha del profesor con alta, edición y activación/desactivación de identificadores.
  - Enlace a la ficha desde `src/app/dashboard/colegio/profesores/ProfesoresPageClient.tsx`.
- **Estadísticas**: `src/lib/colegio/estadisticas.ts` incluye conteo de profesores activos en `totales`; `ColegioEstadisticasPageClient.tsx` muestra tarjeta de profesores.
- **Línea base**: regenerados `docs/architecture/01-modelo-datos.md`, `02-roles-capacidades.md`, `03-pantallas.md`; oráculo de modelos actualizado a 62.
- **Infraestructura de tests**: fixture `crearIdentificadorProfesor` en `src/lib/reporte-test-utils.ts`; orden de limpieza en `src/lib/test-utils.ts`.
- **Gate**: `npx tsc --noEmit`, `npm run lint` (0 errores), `npm run tokens:check`, `npm run arch:check`, `npm run test`, `npm run build` verdes.
