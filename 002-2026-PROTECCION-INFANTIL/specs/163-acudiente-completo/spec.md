# Feature Specification: SPEC-163 — Acudiente completo: identificadores + edición post-alta + conteo

**Feature Branch**: `work/002-pi-062`

**Created**: 2026-08-12

**Status**: IMPLEMENTADO

**Input**: FASE A|163|acudiente-completo del [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §4.1 (eje acudiente), §4.2 (alertas extendidas, impacto en Fase C) y §11 (mapa de fases). Cierra el caso `300DEMOACU005820`. Fuentes vinculantes: SPEC-134 (tenant-first / DAL E-1), SPEC-144 (modelo Estudiante/AcudienteEstudiante), SPEC-145 (modelo Profesor), SPEC-146/147 (wizard y ficha del estudiante).

**Base actual**: `AcudienteEstudiante` es tabla hija de `Estudiante`, máximo 2 filas por estudiante (`orden` 1|2), con `telefono?`/`email?` de contacto. Hoy solo se puede dar de alta en el alta o carga masiva del estudiante; no admite edición ni inactivación posterior, ni lleva identificadores propios para alertas.

**Objetivo de esta fase**: convertir al acudiente en un sujeto completo del modelo de riesgo: gestión post-alta, identificadores tipados para matching futuro y conteos propios en los KPIs del colegio, sin tocar `Curso` ni `Estudiante.cursoId`.

## Impacto en arquitectura:

- **Modelo de datos**: migración aditiva que añade `estado` a `AcudienteEstudiante` y la tabla `IdentificadorAcudiente` (FK a `AcudienteEstudiante`, `Colegio` y `Plataforma`). No se altera `Curso` ni `Estudiante.cursoId`.
- **API**: endpoints REST bajo `/api/colegio/alumnos/[id]/acudientes` y `/api/colegio/acudientes/[id]/identificadores`, validados con Zod y gobernados por permisos de colegio.
- **UI**: sección `SeccionAcudientes` en la ficha del estudiante; conteos de acudientes en KPIs de Inicio y curso.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rector gestiona acudientes de un estudiante (Priority: P1)

Como rector (`SCHOOL_ADMIN`) quiero agregar, editar e inactivar acudientes de un estudiante después de su alta, para mantener actualizados los contactos de reacción sin recargar toda la ficha.

**Why this priority**: cierra el caso real `300DEMOACU005820` (un reporte contra teléfono de acudiente no cruza hoy a alerta) y desbloquea la gestión continua del anillo de reacción.

**Independent Test**: un rector puede ver los acudientes de un estudiante, agregar uno nuevo (hasta 2), editar nombre/relación/contacto, inactivarlo y reactivarlo; otro rector no ve ni toca los acudientes ajenos.

**Acceptance Scenarios**:

1. **Given** un estudiante propio, **When** el rector envía `GET /api/colegio/alumnos/[id]/acudientes`, **Then** recibe los acudientes activos ordenados por `orden` (1, 2) con sus identificadores activos incluidos.
2. **Given** un estudiante con 0 o 1 acudientes activos, **When** envía `POST /api/colegio/alumnos/[id]/acudientes` con `orden`, `nombre`, `relación` y opcionalmente `telefono`/`email`, **Then** se crea el acudiente en estado `activo` y se audita `COLEGIO_ACUDIENTE_CREADO`.
3. **Given** un estudiante que ya tiene 2 acudientes activos, **When** intenta crear un tercero, **Then** recibe `409` con mensaje claro.
4. **Given** un intento de crear un acudiente con `orden` que ya está activo en ese estudiante, **Then** recibe `409` (slot ocupado).
5. **Given** un acudiente propio, **When** envía `PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]` para cambiar nombre, relación, teléfono o email, **Then** se actualiza y se audita `COLEGIO_ACUDIENTE_EDITADO`.
6. **Given** un acudiente propio, **When** envía `PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` con `inactivo`, **Then** el acudiente pasa a inactivo, sus `IdentificadorAcudiente` activos pasan a inactivo y se audita `COLEGIO_ACUDIENTE_DESACTIVADO`.
7. **Given** un acudiente inactivo, **When** envía `PATCH .../estado` con `activo`, **Then** se reactiva si no viola el máximo de 2 activos ni el orden duplicado.
8. **Given** un rector de otro colegio, **When** intenta leer/crear/editar/inactivar un acudiente ajeno, **Then** recibe `404` sin tocar nada (A/B).

---

### User Story 2 — Rector gestiona identificadores de un acudiente (Priority: P1)

Como rector quiero registrar teléfonos, correos, nicks u otros identificadores de un acudiente, para que un reporte contra esos datos pueda generar una alerta en la Fase C.

**Why this priority**: el matching de alertas del BRIEF §4.2 aplica a estudiante, profesor **y acudiente**; sin identificadores registrados el colegio no recibe aviso.

**Independent Test**: un rector puede crear, listar, editar e inactivar identificadores de un acudiente; no puede duplicar `(tipo, valor, plataforma)` para el mismo acudiente.

**Acceptance Scenarios**:

1. **Given** un acudiente propio, **When** el rector envía `GET /api/colegio/acudientes/[id]/identificadores`, **Then** recibe solo los identificadores activos del acudiente.
2. **Given** un acudiente propio y una plataforma válida, **When** envía `POST /api/colegio/acudientes/[id]/identificadores` con `valor` y opcionalmente `tipo`/`plataformaId`, **Then** se crea el identificador, se infiere/normaliza el tipo y valor, y se audita `COLEGIO_IDENTIFICADOR_ACUDIENTE_CREADO`.
3. **Given** un intento de crear el mismo `(tipo, valor, plataforma)` para un acudiente, **Then** recibe `409`.
4. **Given** un identificador existente, **When** envía `PATCH /api/colegio/identificadores-acudiente/[id]` para cambiar valor/tipo/plataforma, **Then** se valida duplicado y se audita `COLEGIO_IDENTIFICADOR_ACUDIENTE_EDITADO`.
5. **Given** un identificador existente, **When** envía `PATCH /api/colegio/identificadores-acudiente/[id]/estado` con `inactivo`, **Then** pasa a inactivo y se audita `COLEGIO_IDENTIFICADOR_ACUDIENTE_DESACTIVADO`.
6. **Given** una plataforma inexistente o de otro catálogo, **When** se intenta usar, **Then** recibe `400`/`404`.
7. **Given** un rector de otro colegio, **When** intenta leer/crear/editar/inactivar un identificador de acudiente ajeno, **Then** recibe `404`.

---

### User Story 3 — El sistema cuenta acudientes en los KPIs del colegio (Priority: P2)

Como rector quiero saber cuántos acudientes tiene mi colegio y cuántos estudiantes tienen acudiente activo, para completar el anillo de reacción y la ficha del estudiante.

**Why this priority**: "contarlos" es parte explícita de la fase; además el anillo de protección ya distingue "con acudiente a quien llamar".

**Independent Test**: los conteos de acudientes reflejan solo acudientes activos de estudiantes activos y respetan el aislamiento por colegio.

**Acceptance Scenarios**:

1. **Given** la home del rector, **When** se carga, **Then** el KPI incluye `acudientes` = total de acudientes activos de estudiantes activos del colegio.
2. **Given** el escritorio de un curso, **When** se carga, **Then** se muestra el total de acudientes activos del curso y el porcentaje de estudiantes con al menos un acudiente activo (reacción).
3. **Given** la ficha de un estudiante, **When** se carga, **Then** se muestra el conteo de acudientes activos y el listado editable.
4. **Given** un acudiente inactivado, **Then** deja de contar en todos los KPIs; si todos los acudientes de un estudiante están inactivos, ese estudiante no cuenta para la cobertura de reacción.
5. **Given** un estudiante inactivo, **Then** sus acudientes no cuentan en los KPIs del colegio.

---

### Edge Cases

- **Máximo 2 acudientes activos**: el sistema rechaza un tercero con `409`; la inactivación libera el slot.
- **Orden duplicado activo**: `@@unique([estudianteId, orden, estado])` garantiza un solo acudiente activo por orden.
- **Inactivación en cascada**: inactivar un acudiente inactiva sus identificadores; no se borra nada físicamente.
- **Teléfono/email vs. identificadores**: los campos `telefono`/`email` de `AcudienteEstudiante` siguen siendo contactos legibles; no se sincronizan automáticamente con `IdentificadorAcudiente`.
- **Identificador duplicado por acudiente**: la combinación `(acudienteId, tipo, valor, plataformaId)` es única; cambios de mayúsculas/espacios se normalizan antes de la comparación.
- **Cross-tenant**: todo acceso a acudientes e identificadores se valida contra `colegioId`; un recurso ajeno devuelve `404`.
- **Backfill**: los acudientes existentes quedan con `estado = "activo"`; no se crean `IdentificadorAcudiente` automáticamente a partir de `telefono`/`email` (el rector los registrará explícitamente).
- **Fase C**: `IdentificadorAcudiente` será fuente de matching para alertas; en esta fase no se modifica `AlertaColegio`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir el modelo `IdentificadorAcudiente` con `tipo`, `valor`, `plataformaId` y `estado`, vinculado N:M a `AcudienteEstudiante`.
- **FR-002**: El sistema DEBE permitir al `SCHOOL_ADMIN` gestionar acudientes de un estudiante (alta, edición, inactivación, reactivación) desde la ficha del estudiante.
- **FR-003**: El sistema DEBE permitir al `SCHOOL_ADMIN` gestionar identificadores de un acudiente (alta, edición, inactivación, reactivación).
- **FR-004**: El sistema DEBE mantener el límite de máximo 2 acudientes activos por estudiante (`orden` 1|2).
- **FR-005**: El sistema DEBE añadir `estado` a `AcudienteEstudiante` como baja lógica aditiva (`activo`/`inactivo`).
- **FR-006**: El sistema DEBE inactivar en cascada los `IdentificadorAcudiente` activos cuando se inactiva su acudiente.
- **FR-007**: El sistema DEBE garantizar que no haya identificadores duplicados para el mismo acudiente (`@@unique([acudienteId, tipo, valor, plataformaId])`).
- **FR-008**: El sistema DEBE normalizar el valor del identificador e inferir el tipo cuando no se envíe, reutilizando las mismas reglas que `IdentificadorEstudiante`.
- **FR-009**: El sistema DEBE exponer endpoints REST para acudientes bajo `/api/colegio/alumnos/[id]/acudientes`.
- **FR-010**: El sistema DEBE exponer endpoints REST para identificadores de acudiente bajo `/api/colegio/acudientes/[id]/identificadores` (CRUD) y `/api/colegio/identificadores-acudiente/[id]` (edición/estado).
- **FR-011**: El sistema DEBE actualizar la ficha del estudiante para listar, agregar, editar e inactivar acudientes y sus identificadores.
- **FR-012**: El sistema DEBE contar acudientes activos en la home del rector, en el escritorio del curso y en la ficha del estudiante.
- **FR-013**: El sistema DEBE auditar las mutaciones sobre `AcudienteEstudiante` e `IdentificadorAcudiente`.
- **FR-014**: El sistema NO DEBE modificar `Curso` ni `Estudiante.cursoId`.
- **FR-015**: El sistema NO DEBE tocar `src/lib/ai/**` ni el motor de clasificación.

### Key Entities

- **AcudienteEstudiante** (actualizado): `id`, `estudianteId`, `orden`, `nombre`, `relacion`, `telefono?`, `email?`, `estado` (`activo`/`inactivo`), `createdAt`, `updatedAt`.
- **IdentificadorAcudiente** (nuevo): `id`, `acudienteId`, `colegioId`, `tipo`, `valor`, `plataformaId?`, `estado` (`activo`/`inactivo`), `createdAt`, `updatedAt`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un rector puede gestionar acudientes de un estudiante desde la ficha: agregar hasta 2, editar e inactivar.
- **SC-002**: Un rector puede gestionar identificadores de cada acudiente con normalización, inferencia de tipo y detección de duplicados.
- **SC-003**: El 100% de las operaciones sobre acudientes e identificadores respetan el aislamiento por `colegioId`.
- **SC-004**: Los conteos de acudientes en home, curso y ficha reflejan solo acudientes activos de estudiantes activos del colegio.
- **SC-005**: Cada mutación de acudiente o identificador genera un `AuditLog` inmutable.
- **SC-006**: La migración de BD es aditiva: añade `estado` a `AcudienteEstudiante` y crea `IdentificadorAcudiente`; no modifica `Curso` ni `Estudiante.cursoId`.
- **SC-007**: No se producen cambios en `src/lib/ai/**` ni en el flujo de clasificación.

---

## Impacto en arquitectura

- **Modelo de datos**: `AcudienteEstudiante` gana `estado`; nueva tabla `IdentificadorAcudiente` con FKs a `AcudienteEstudiante`, `Plataforma` y `Colegio`. Migración puramente aditiva.
- **DAL**: nuevos repositorios `AcudienteEstudianteRepository` y `IdentificadorAcudienteRepository` (patrón tenant-first SPEC-134). `EstudianteRepository` y `ColegioResumenRepository` actualizan sus conteos de cobertura.
- **API**: endpoints bajo `/api/colegio/alumnos/[id]/acudientes` y `/api/colegio/acudientes/[id]/identificadores`, con validación Zod y rate limiting.
- **UI**: sección de acudientes editable en `/dashboard/colegio/alumnos/[id]`; KPIs actualizados en home y escritorio de curso.
- **Auditoría**: acciones `COLEGIO_ACUDIENTE_*` e `COLEGIO_IDENTIFICADOR_ACUDIENTE_*` en `AccionAudit`.
- **Arquitectura**: la línea base generada (`docs/architecture/`) se regenera para reflejar tablas, rutas y pantallas nuevas.
- **Fase C**: `IdentificadorAcudienteRepository.buscarActivosPorValor` alimentará `notificarColegioSiCorresponde`; `AlertaColegio` se generalizará entonces para referenciar sujeto (estudiante/profesor/acudiente). En esta fase no se toca `AlertaColegio`.

---

## Assumptions

- `AcudienteEstudiante.telefono`/`email` siguen siendo contactos de visualización; los identificadores tipados para alertas viven en `IdentificadorAcudiente`.
- La baja de acudiente es lógica (`estado = "inactivo"`); no se permite borrado físico.
- Solo `SCHOOL_ADMIN` administra acudientes e identificadores de acudiente; se reusa el módulo `colegios_gestion`.
- La Fase C extenderá el matching de alertas a acudientes y profesores; esta fase solo prepara los datos.
- No se requiere sincronización automática entre `telefono`/`email` y `IdentificadorAcudiente`.
- `Curso` y `Estudiante.cursoId` no cambian en esta fase.

---

## Implementación

- Migración aditiva `20260812051055_spec_163_acudiente_completo`: añade `estado` a `AcudienteEstudiante`, crea `IdentificadorAcudiente` y actualiza índices.
- Schema: relaciones `IdentificadorAcudiente` → `AcudienteEstudiante`, `Colegio`, `Plataforma`; `AcudienteEstudiante` → `IdentificadorAcudiente[]`.
- Repositorios DAL tenant-first: `src/lib/dal/repositories/acudiente-estudiante.ts` e `identificador-acudiente.ts` con tests.
- Endpoints: `src/app/api/colegio/alumnos/[id]/acudientes/**` y `src/app/api/colegio/acudientes/[id]/identificadores/**` con tests.
- UI: `src/app/dashboard/colegio/alumnos/[id]/SeccionAcudientes.tsx` integrada en `AlumnoDetallePageClient.tsx`; conteos de acudientes en `HomeRectorPage`, `CursoEscritorioClient` y `TarjetasCurso`.
- KPIs: `src/lib/dal/repositories/estudiante.ts` y `colegio-resumen.ts` actualizados para contar acudientes activos por colegio/curso.
- Auditoría: acciones `COLEGIO_ACUDIENTE_*` e `COLEGIO_IDENTIFICADOR_ACUDIENTE_*` registradas en mutaciones.
- Infraestructura de tests: `src/lib/test-utils.ts` ajustado para el orden de limpieza de identificadores/acudientes; `vitest.config.ts` fuerza secuencia serial dentro de cada archivo para evitar race conditions sobre la BD compartida.
- Línea base regenerada (`docs/architecture/01-modelo-datos.md`, `02-roles-capacidades.md`); oráculo de modelos actualizado a 61.
- Ver evidencia completa en `cierre.md`.
