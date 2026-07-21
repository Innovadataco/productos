# Feature Specification: Colegios · Fase 4 — Alertas y Consulta anonimizada

**Feature Branch**: `feature/001-scaffolding`

**Spec**: `077-colegios-alertas-consulta`

**Created**: 2026-07-21

**Status**: CERRADA

**Input**: Fase 4 del módulo Colegios. Conectar los identificadores registrados por el colegio con el motor de matching del Círculo de Confianza. Cuando un reporte menciona un identificador del colegio, se genera una alerta anónima para ese colegio. El colegio solo ve información anonimizada, nunca texto crudo del reporte ni identidad del denunciante.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El sistema genera alertas para el colegio (Priority: P1)

Cuando un reporte anónimo o autenticado menciona un identificador que el colegio tiene registrado, el sistema debe crear una alerta asociada a ese colegio sin exponer datos sensibles.

**Why this priority**: Es el objetivo central de la fase: darle al colegio visibilidad sobre riesgos que afectan a sus alumnos sin violar privacidad.

**Independent Test**: Procesar un reporte que contenga un identificador registrado por un colegio debe crear una alerta para ese colegio y solo ese colegio.

**Acceptance Scenarios**:

1. **Given** un colegio con un identificador `+573001234567` registrado para un alumno, **When** llega un reporte con ese identificador, **Then** se crea una alerta para ese colegio.
2. **Given** un reporte con identificador que coincide con identificadores de dos colegios distintos, **When** se procesa, **Then** cada colegio recibe su propia alerta aislada.
3. **Given** un reporte que no coincide con ningún identificador de colegio, **When** se procesa, **Then** no se crean alertas de colegio.
4. **Given** un reporte que está eliminado o en estado no visible, **When** se procesa, **Then** no se genera alerta para colegios.

**Edge Cases**:
- Identificador registrado pero inactivo: no genera alerta.
- Colegio inactivo o vencido: no genera alerta.
- Múltiples alumnos del mismo colegio con el mismo identificador: una sola alerta por colegio+reporte (o una por alumno, documentar decisión).
- Reporte duplicado: no generar alerta duplicada.

---

### User Story 2 — SCHOOL_ADMIN ve alertas de su colegio anonimizadas (Priority: P1)

El administrador institucional debe poder ver un listado de alertas generadas para su colegio. La información mostrada debe estar anonimizada: nunca texto crudo del reporte, nunca identidad del denunciante, nunca PII de menores ajenos.

**Why this priority**: La privacidad es la regla dura de esta fase; el colegio debe poder actuar sin recibir datos sensibles.

**Independent Test**: Un SCHOOL_ADMIN autenticado puede listar las alertas de su colegio y ver solo: identificador, relación (alumno/madre/etc.), categoría del reporte, estado, fecha, y opciones para marcar como gestionada.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado con alertas en su colegio, **When** lista las alertas, **Then** ve solo las de su colegio.
2. **Given** una alerta en el listado, **Then** no se muestra el texto del reporte, la ciudad, el país, la edad, la plataforma, ni el identificador del denunciante.
3. **Given** un SCHOOL_ADMIN de otro colegio, **When** intenta listar alertas, **Then** no ve alertas ajenas y recibe 403/404 si intenta acceder a una alerta específica.
4. **Given** una alerta, **When** el SCHOOL_ADMIN la marca como "vista" o "gestionada", **Then** el estado cambia y se registra auditoría.

**Edge Cases**:
- Alerta de un reporte dado de baja: debe ocultarse del listado (o marcarse como retirada).
- Alerta de un identificador desactivado después de la alerta: la alerta sigue visible (historial) pero no se generan nuevas.
- Sin alertas: mostrar estado vacío con mensaje informativo.

---

### User Story 3 — Aviso ciego al colegio (Priority: P2)

Cuando se genera una alerta, el sistema puede enviar un aviso genérico al SCHOOL_ADMIN (email) para que ingrese a validar. El aviso no contiene datos del reporte.

**Why this priority**: Empuja al colegio a revisar sin exponer información en el email.

**Acceptance Scenarios**:

1. **Given** una alerta nueva y el parámetro `colegio.notificaciones.enabled=true`, **When** se genera, **Then** el sistema envía un email genérico: "Tiene novedades para revisar en su panel. Ingrese y valide.".
2. **Given** el parámetro desactivado, **When** se genera una alerta, **Then** no se envía email.
3. **Given** un SCHOOL_ADMIN con notificaciones desactivadas, **When** se genera una alerta, **Then** no se envía email.

**Edge Cases**:
- Cooldown para no spammear: 24h por defecto.
- SCHOOL_ADMIN sin email: omitir.

---

## Edge Cases (generales)

- Matching debe ser case-insensitive y sin espacios extremos (usar normalización existente).
- Un colegio no debe poder inferir que otro colegio tiene el mismo identificador registrado.
- No se debe permitir a un SCHOOL_ADMIN ver el detalle de un reporte (`/api/reportes/*`) usando el ID de un reporte de alerta.
- La alerta debe actualizarse si el estado del reporte cambia (ej. de CLASIFICADO a CORREGIDO o dado de baja).
- Fase 4 no permite al colegio responder ni actuar sobre el reporte; solo ver alertas y marcar gestión interna.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear una alerta de colegio cuando un reporte visible menciona un identificador registrado por ese colegio.
- **FR-002**: El sistema DEBE asociar la alerta al `colegioId` y NO permitir que un SCHOOL_ADMIN vea alertas de otro colegio.
- **FR-003**: El sistema DEBE mostrar en la consulta del colegio únicamente: identificador, etiqueta de relación, categoría del reporte, estado del reporte, fecha de creación y estado de gestión de la alerta.
- **FR-004**: El sistema NO DEBE mostrar texto crudo del reporte, ciudad, país, edad de la víctima, plataforma, ni identificador del denunciante en la alerta ni en la consulta del colegio.
- **FR-005**: El sistema DEBE permitir al SCHOOL_ADMIN marcar una alerta como `vista` o `gestionada`.
- **FR-006**: El sistema DEBE integrar el matching en el worker de procesamiento de reportes, sin alterar el flujo del Círculo de Confianza.
- **FR-007**: El sistema DEBE reutilizar el anonimizador existente si es necesario; NO crear un nuevo anonimizador.
- **FR-008**: El sistema DEBE enviar un aviso ciego (email genérico) al SCHOOL_ADMIN cuando se genere una alerta, si las notificaciones están habilitadas y no hay cooldown activo.
- **FR-009**: El sistema DEBE registrar auditoría (`COLEGIO_ALERTA_*`) para creación y gestión de alertas.
- **FR-010**: El sistema DEBE ocultar alertas cuyo reporte haya sido dado de baja o eliminado.
- **FR-011**: El sistema DEBE evitar duplicados: no crear dos alertas para el mismo colegio+reporte+identificador.
- **FR-012**: El sistema DEBE aplicar el tema visual verde en la vista de alertas del colegio.

### Key Entities

- **AlertaColegio**: `id`, `colegioId`, `reporteId`, `identificadorAlumnoId`, `estado` (`nueva` | `vista` | `gestionada`), `creadoEn`, `actualizadoEn`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las alertas creadas pertenecen al colegio correcto; tests de aislamiento pasan.
- **SC-002**: El 100% de las consultas de alertas no exponen texto crudo ni PII de menores ajenos; tests de privacidad pasan.
- **SC-003**: El matching funciona con identificadores normalizados (trim, lowercase).
- **SC-004**: Todos los endpoints de Fase 4 tienen tests de integración.
- **SC-005**: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npx vitest run` pasan sin errores.
- **SC-006**: Deploy limpio con `./scripts/dev-restart.sh` y healthcheck ok.

---

## Assumptions

- La Fase 3 (spec 076) está cerrada con `IdentificadorAlumno` cargado y normalizado.
- El modelo `Reporte` tiene `identificador`, `estado`, `eliminado`, `categoria`, `creadoEn`.
- El worker de procesamiento ya llama a `notificarCambioCirculoSiCorresponde` tras procesar un reporte.
- El sistema de email puede enviar avisos genéricos; se reutiliza `enviarAlertaCirculoConfianza` o similar.
- El SCHOOL_ADMIN tiene un email configurado.

---

## Implementación

### Resumen

Se implementó la Fase 4 del módulo Colegios: alertas anonimizadas generadas cuando un reporte visible menciona un identificador registrado por un colegio, y consulta anonimizada para el SCHOOL_ADMIN.

### Decisiones técnicas

- **Entidad `AlertaColegio`**: tabla aditiva vinculada a `colegioId`, `reporteId` e `identificadorAlumnoId`, con restricción única por `(colegioId, reporteId, identificadorAlumnoId)` para evitar duplicados.
- **Matching**: se reutilizó el patrón del Círculo de Confianza comparando `reporte.identificador` (normalizado con trim/lowercase) contra `IdentificadorAlumno.valor` activos. Se verifica vigencia del colegio antes de crear la alerta.
- **Anonimización**: la consulta de alertas solo expone identificador, relación, categoría del reporte, estado del reporte, estado de la alerta y fecha. Nunca expone texto, ciudad, país, edad, plataforma ni identidad del denunciante.
- **Estados de alerta**: `nueva`, `vista`, `gestionada`.
- **Notificaciones**: email genérico ciego al SCHOOL_ADMIN, con parámetros `colegio.notificaciones.enabled` y `colegio.notificaciones.cooldown_horas`, y campo `Usuario.ultimaNotificacionColegioEn` para cooldown.
- **Worker**: `notificarColegioSiCorresponde(reporteId)` se ejecuta después de `notificarCambioCirculoSiCorresponde`, con `.catch(...)` para no romper el flujo.
- **UI**: listado en `/dashboard/colegio/alertas` con tema verde, filtros y botones para marcar vista/gestionada.

### Archivos modificados/creados

- `prisma/schema.prisma`
- `prisma/migrations/20260721090000_add_alerta_colegio/migration.sql`
- `src/lib/colegio/alertas.ts`
- `src/lib/colegio/alertas.test.ts`
- `src/lib/email.ts`
- `src/lib/schemas/index.ts`
- `src/lib/test-utils.ts`
- `scripts/worker-reportes.mjs`
- `src/app/api/colegio/alertas/route.ts`
- `src/app/api/colegio/alertas/route.test.ts`
- `src/app/api/colegio/alertas/[id]/estado/route.ts`
- `src/app/dashboard/colegio/alertas/page.tsx`
- `src/app/dashboard/colegio/page.tsx`

### Pruebas y validación

- `npx tsc --noEmit`: sin errores.
- `npm run lint`: sin errores.
- `npx vitest run`: 704 tests verdes (≥ 678).
- `npm run build`: exitoso.
- `./scripts/dev-restart.sh`: healthcheck OK, un worker.
- Quickstart probado manualmente con requests HTTP: registro de identificador, creación de reporte, procesamiento por worker, visualización de alerta, cambio de estado, aislamiento por rol y ocultamiento ante reporte dado de baja.

### Deuda técnica

- El matching es exacto normalizado; no se implementó búsqueda aproximada ni normalización de formatos de teléfono (ej. `3007770777` vs `+573007770777`). Se puede mejorar en Fase 5 con una tabla de normalización canónica.
- La notificación por email usa un solo SCHOOL_ADMIN por colegio; si se soportan múltiples admins en el futuro, se debe iterar.
- El reporte dado de baja oculta la alerta del listado pero no cambia su estado; Fase 5 puede definir un estado `retirada`.

### Commits

Ver `git log` en evidencia de cierre.
