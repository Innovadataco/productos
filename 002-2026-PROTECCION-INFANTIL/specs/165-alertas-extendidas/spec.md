# Feature Specification: SPEC-165 — Alertas extendidas: matching sobre profesor/acudiente + tipo de sujeto

**Feature Branch**: `work/002-pi-XXX`

**Created**: 2026-08-12

**Status**: PLANEADO

**Input**: [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §4.2 (reglas de generación de alerta) y §11 Fase C. Fuentes vinculantes: SPEC-077/139 (alertas por identificador registrado), SPEC-134 (tenant-first / DAL E-1), SPEC-145 (modelo `Profesor`), SPEC-149 (pipeline de avisos), SPEC-159 (seguimiento del caso).

**Prerrequisitos asumidos**:
- Fase A — Acudiente completo: existe `IdentificadorAcudiente` con patrón `IdentificadorEstudiante`.
- Fase B — Identificadores de profesor: existe `IdentificadorProfesor` con patrón `IdentificadorEstudiante`.
- SPEC-162 — Materia configurable: ya implementada; `Curso` y `Estudiante.cursoId` no se tocan.

## Impacto en arquitectura:

- **Modelo de datos**: la tabla `AlertaColegio` añade el campo `sujetoTipo` para distinguir estudiante/profesor/acudiente; no se borran alertas históricas.
- **Motor/Worker**: `notificarColegioSiCorresponde` consulta `IdentificadorEstudiante`, `IdentificadorProfesor` e `IdentificadorAcudiente` para generar alertas ampliadas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El worker cruza reportes contra identificadores de estudiante, profesor y acudiente (Priority: P1)

Como plataforma, quiero que `notificarColegioSiCorresponde` busque el identificador reportado no solo entre los estudiantes, sino también entre los profesores y acudientes registrados por el colegio, para cerrar el caso real `300DEMOACU005820` y ampliar la cobertura de alertas.

**Why this priority**: sin este matching, un reporte contra el teléfono de un acudiente o de un profesor registrado no genera alerta, dejando al colegio sin aviso.

**Independent Test**: un mismo identificador registrado como estudiante A, profesor B y acudiente C en el mismo colegio genera tres alertas distintas para un mismo reporte visible; otro colegio con el mismo identificador registrado también recibe sus alertas.

**Acceptance Scenarios**:

1. **Given** un reporte visible cuyo identificador coincide con un `IdentificadorEstudiante` activo, **When** corre el post-hook del worker, **Then** se crea una `AlertaColegio` con `tipoSujeto = ESTUDIANTE`.
2. **Given** un reporte visible cuyo identificador coincide con un `IdentificadorProfesor` activo, **When** corre el post-hook, **Then** se crea una `AlertaColegio` con `tipoSujeto = PROFESOR`.
3. **Given** un reporte visible cuyo identificador coincide con un `IdentificadorAcudiente` activo, **When** corre el post-hook, **Then** se crea una `AlertaColegio` con `tipoSujeto = ACUDIENTE`.
4. **Given** un identificador registrado en estudiante, profesor y acudiente del mismo colegio, **When** llega un reporte visible, **Then** se crean tres alertas del mismo colegio para el mismo reporte, una por sujeto, sin duplicados.
5. **Given** un identificador registrado en estudiantes de dos colegios distintos, **When** llega un reporte visible, **Then** cada colegio recibe su alerta (cross-tenant intencional, como hoy).
6. **Given** un reporte en estado NO visible (PENDIENTE, PROCESANDO, DUPLICADO, etc.), **When** corre el hook, **Then** no se crea ninguna alerta.

---

### User Story 2 — La alerta marca el tipo de sujeto (Priority: P1)

Como rector, quiero ver en cada alerta si corresponde a un estudiante, un profesor o un acudiente, para saber a quién debe atender el caso sin ver el contenido del reporte ni quién lo reportó.

**Why this priority**: el tipo de sujeto cambia el protocolo de atención del colegio y es información no sensible que el brief §4.2 autoriza explícitamente.

**Independent Test**: el listado de alertas incluye `tipoSujeto` para alertas nuevas y migradas; las alertas históricas de estudiante se leen como `ESTUDIANTE` tras el backfill.

**Acceptance Scenarios**:

1. **Given** una alerta recién creada sobre un estudiante, **When** se consulta por API/UI, **Then** `tipoSujeto = ESTUDIANTE`.
2. **Given** una alerta recién creada sobre un profesor, **When** se consulta, **Then** `tipoSujeto = PROFESOR`.
3. **Given** una alerta recién creada sobre un acudiente, **When** se consulta, **Then** `tipoSujeto = ACUDIENTE`.
4. **Given** alertas históricas creadas antes de esta feature, **When** se migran, **Then** `tipoSujeto = ESTUDIANTE` y `identificadorEstudianteId` se mantiene.
5. **Given** el detalle de una alerta, **When** se renderiza, **Then** nunca se expone el texto del reporte, el denunciante ni el valor exacto del identificador (I-28/I-29).

---

### User Story 3 — Bandeja de alertas distingue sujetos (Priority: P2)

Como rector, quiero filtrar y ver el tipo de sujeto en la bandeja de alertas, para priorizar la revisión sin confundir estudiante con adulto.

**Why this priority**: cierra la usabilidad de la alerta extendida; es requisito menor que el matching, pero necesario para que el rector actúe.

**Independent Test**: el listado de alertas expone `tipoSujeto` y permite filtrar por él; la API responde en < 500 ms con 100 alertas.

**Acceptance Scenarios**:

1. **Given** la bandeja de alertas, **When** se lista, **Then** cada fila muestra el tipo de sujeto (icono + texto).
2. **Given** un filtro por `tipoSujeto`, **When** se aplica, **Then** solo se devuelven alertas de ese sujeto.
3. **Given** una alerta sobre profesor/acudiente, **When** se abre su seguimiento, **Then** el resumen ejecutivo refleja el tipo de sujeto y los metadatos permitidos (curso solo cuando aplica).

---

### Edge Cases

- **Identificador duplicado en varios sujetos del mismo colegio**: se genera una alerta por sujeto; el unique constraint por tipo evita duplicados dentro del mismo tipo.
- **Alertas históricas sin `tipoSujeto`**: backfill a `ESTUDIANTE` (único caso posible antes de esta feature).
- **Sujeto inactivo**: solo identificadores activos generan alertas; si el sujeto se da de baja después, las alertas ya creadas permanecen.
- **Reporte con múltiples identificadores**: el matching se hace por el `identificador` del reporte; si un reporte tuviera varios, cada uno se evalúa por separado (patrón existente).
- **Cross-tenant**: el matching sigue siendo cross-tenant a propósito para avisar a cada colegio que registró el identificador.
- **Fail-open**: un error en el matching de un sujeto no impide el matching de los otros ni el resto del pipeline.
- **Curso no aplica a profesor/acudiente**: en el detalle, el curso solo se muestra cuando `tipoSujeto = ESTUDIANTE`; para PROFESOR/ACUDIENTE se omite o se muestra "no aplica".

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extender `notificarColegioSiCorresponde` para buscar el identificador reportado en `IdentificadorEstudiante`, `IdentificadorProfesor` e `IdentificadorAcudiente` activos.
- **FR-002**: El sistema DEBE crear una `AlertaColegio` por cada sujeto distinto cuyo identificador activo coincida con el reporte visible.
- **FR-003**: La `AlertaColegio` DEBE incluir `tipoSujeto` con valores cerrados `ESTUDIANTE | PROFESOR | ACUDIENTE`.
- **FR-004**: El sistema DEBE almacenar el vínculo específico según el tipo: `identificadorEstudianteId`, `identificadorProfesorId` o `identificadorAcudienteId`.
- **FR-005**: El sistema DEBE garantizar que solo una de las tres FKs esté poblada y coincida con `tipoSujeto` (validación en creación).
- **FR-006**: El sistema DEBE evitar duplicados por (colegio, reporte, sujeto) mediante un unique constraint por tipo.
- **FR-007**: El sistema DEBE hacer backfill de `tipoSujeto = ESTUDIANTE` para alertas históricas y mantener `identificadorEstudianteId`.
- **FR-008**: El listado y detalle de alertas DEBEN exponer `tipoSujeto` sin revelar contenido del reporte, denunciante ni valor del identificador.
- **FR-009**: El pipeline de avisos (`registrarEventoAviso` / `evaluarUmbralesPorAlerta`) DEBE seguir funcionando para alertas de cualquier tipo; `entidadId` sigue siendo `reporteId`.
- **FR-010**: El seguimiento del caso (`SeguimientoCaso`) DEBE vincularse a alertas de cualquier tipo; el tipo de sujeto se expone en el resumen.
- **FR-011**: La agregación de patrones institucionales (`agregarPatronPorReporte`) DEBE continuar usando las alertas como marcador de idempotencia, independientemente del tipo de sujeto.
- **FR-012**: Todo cambio de schema DEBE ser aditivo: no modificar `Curso` ni `Estudiante.cursoId`; `AlertaColegio` puede hacerse `identificadorEstudianteId` nullable y añadir columnas/relaciones/constraints.
- **FR-013**: Toda mutación sobre alertas DEBE registrar `AuditLog` con metadatos (sin PII).

### Key Entities

- **AlertaColegio** (modificada): añade `tipoSujeto String/enum`, `identificadorProfesorId?`, `identificadorAcudienteId?`; `identificadorEstudianteId` pasa a opcional; relaciones a `IdentificadorProfesor` e `IdentificadorAcudiente`; unique constraints por tipo.
- **IdentificadorProfesor** (prerrequisito Fase B): patrón `IdentificadorEstudiante`, FK a `Profesor`, campo `valor` indexado para búsqueda.
- **IdentificadorAcudiente** (prerrequisito Fase A): patrón `IdentificadorEstudiante`, FK a `AcudienteEstudiante`, campo `valor` indexado para búsqueda.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un reporte visible cuyo identificador está en estudiante, profesor y acudiente del mismo colegio genera exactamente tres alertas con los tipos correctos.
- **SC-002**: El 100% de las alertas históricas quedan con `tipoSujeto = ESTUDIANTE` tras la migración.
- **SC-003**: El listado de alertas responde en < 500 ms con 100 filas e incluye `tipoSujeto`.
- **SC-004**: El pipeline de avisos y los umbrales no se rompen para alertas de profesor/acudiente.
- **SC-005**: `notificarColegioSiCorresponde` es idempotente: reejecutar el hook no duplica alertas.
- **SC-006**: No hay fugas cross-tenant: un colegio solo ve alertas de su `colegioId`.
- **SC-007**: Ninguna superficie expone texto del reporte, denunciante o valor del identificador.
- **SC-008**: Gates verdes: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `npm run arch:check`.

---

## Impacto en arquitectura

- **Modelo de datos**: `AlertaColegio` se extiende con `tipoSujeto` y dos FKs opcionales; `identificadorEstudianteId` pasa a opcional; se añaden constraints únicas por tipo de sujeto.
- **DAL**: `AlertaColegioRepository` debe adaptar sus queries SQL crudas y sus métodos de agregación para soportar los tres tipos de vínculo.
- **Servicio**: `notificarColegioSiCorresponde` consulta tres repositorios y enruta la alerta al tipo correcto.
- **Worker**: sin cambios en `scripts/worker-reportes.mjs`; el post-hook sigue llamando al mismo servicio.
- **API/UI**: el listado y detalle de alertas exponen `tipoSujeto`; los filtros se extienden.
- **Auditoría**: las acciones existentes (`COLEGIO_ALERTA_CREADA`, `COLEGIO_ALERTA_ESTADO`) se mantienen; el `valorNuevo` incluye `tipoSujeto`.
- **Arquitectura**: la línea base generada (`docs/architecture/`) se regenera para reflejar el schema modificado.

---

## Assumptions

- Las Fases A y B ya entregaron `IdentificadorAcudiente` e `IdentificadorProfesor` con el mismo patrón de `IdentificadorEstudiante` (CRUD, tenant, baja suave, índice por `valor`).
- `Curso` y `Estudiante.cursoId` no cambian en esta fase.
- El matching sigue siendo cross-tenant a propósito: un identificador registrado por varios colegios genera alertas para cada uno.
- El valor del identificador se normaliza de la misma forma (trim + lowercase) para estudiante, profesor y acudiente.
- El pipeline de avisos y los umbrales se mantienen a nivel de reporte; no se añaden tipos de evento nuevos en esta fase.
- La UI de la bandeja de alertas ya existe (SPEC-129/143/158); esta fase solo añade el campo `tipoSujeto` y su filtro.
- No se toca `src/lib/ai/**`; el matching es un query post-procesamiento.

---

## Implementación

*Por completar al cerrar la fase.*
