# Feature Specification: SPEC-173 — Módulo Colegio: restructura de navegación por rol + fixes H01-H06

**Feature Branch**: `work/002-pi-071`

**Created**: 2026-08-17

**Status**: PLANEADO

Impacto en arquitectura: modifica navegación gobernada por rol (`src/lib/nav-items.ts`, layouts del área Colegio, `src/lib/proxy.ts`), mueve la administración del comité de `/dashboard/colegio/comite` a `/dashboard/colegio/comite/integrantes`, añade rutas nuevas del rol comité (`/dashboard/colegio/comite` como home, `/dashboard/colegio/comite/estadisticas`), ajusta schemas Zod (`src/lib/schemas/index.ts`) y el DTO de estadísticas (`src/lib/colegio/inteligencia.ts`). Requiere regenerar `docs/architecture/` y dejar `npm run arch:check` verde.

**Input**: Instructivo 002-PI-071. Contexto: el CEO probó el módulo Colegio en producción (689d46ac, 2026-08-17) y cerró (a) la navegación DEFINITIVA de los 2 roles del área — RECTOR con 8 items exactos, COMITÉ DE CONVIVENCIA con 3 items propios — y (b) 6 hallazgos H01-H06 detectados en la prueba. Todo el diseño viene inline en el instructivo (Bloques A y B).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El rector navega con el menú definitivo de 8 items (Priority: P1)

Como rector (SCHOOL_ADMIN) quiero un menú con exactamente mis 8 secciones de trabajo — Inicio, Estadísticas, Alertas, Cursos, Casos comité, Usuarios (Profesores + Comité de convivencia), Configuración, Auditoría — para no perderme entre pantallas de asistente o acciones puntuales.

**Why this priority**: la navegación es la columna del módulo; el CEO la cerró como definitiva tras probar en prod.

**Independent Test**: iniciar sesión como rector y verificar que el menú lateral muestra exactamente 8 items (con "Usuarios" expandible a Profesores y Comité de convivencia) y que Onboarding, Materias y Subir lista NO aparecen.

**Acceptance Scenarios**:

1. **Given** un usuario SCHOOL_ADMIN autenticado, **When** abre cualquier pantalla de `/dashboard/colegio`, **Then** el menú muestra exactamente: Inicio (`/dashboard/colegio`), Estadísticas (`/dashboard/colegio/estadisticas`), Alertas (`/dashboard/colegio/alertas`), Cursos (`/dashboard/colegio/cursos`), Casos comité (`/dashboard/colegio/comite/casos`), Usuarios (nodo expandible con Profesores → `/dashboard/colegio/profesores` y Comité de convivencia → `/dashboard/colegio/comite/integrantes`), Configuración (`/dashboard/colegio/configuracion`), Auditoría (`/dashboard/colegio/auditoria`).
2. **Given** el menú del rector, **Then** NO contiene los items Onboarding, Materias ni Subir lista.
3. **Given** las rutas retiradas del menú (`/dashboard/colegio/onboarding`, `/dashboard/colegio/materias`, `/dashboard/colegio/cursos/unificado`), **When** el rector navega directo a ellas, **Then** siguen siendo accesibles (no 404 ni 403).
4. **Given** la administración del comité (creación de cuenta e integrantes) que vivía en `/dashboard/colegio/comite`, **When** el rector entra a Usuarios → Comité de convivencia, **Then** la encuentra en `/dashboard/colegio/comite/integrantes`.

---

### User Story 2 — El comité de convivencia tiene su propia vista de 3 items (Priority: P1)

Como integrante del comité de convivencia (COMITE_CONVIVENCIA) quiero un menú propio con solo Inicio, Estadísticas y Gestión casos, para trabajar mis casos sin ver las funciones del rector.

**Why this priority**: el rol comité hoy aterriza en la administración del comité (que es del rector); necesita su propia home operativa y su propio menú.

**Independent Test**: iniciar sesión como COMITE_CONVIVENCIA y verificar que el menú muestra exactamente 3 items y que ninguna ruta del rector es accesible.

**Acceptance Scenarios**:

1. **Given** un usuario COMITE_CONVIVENCIA autenticado, **When** entra a `/dashboard/colegio/comite`, **Then** ve la nueva home del rol: resumen de casos abiertos, sus pendientes y SLA — sin contenido de reportes ni denunciante.
2. **Given** el menú del comité, **Then** muestra exactamente: Inicio (`/dashboard/colegio/comite`), Estadísticas (`/dashboard/colegio/comite/estadisticas`), Gestión casos (`/dashboard/colegio/comite/casos`).
3. **Given** la página `/dashboard/colegio/comite/estadisticas`, **Then** muestra casos por estado, tiempo medio de resolución y categorías más escaladas — SIN contenido de reportes ni datos del denunciante.
4. **Given** un usuario COMITE_CONVIVENCIA, **When** intenta abrir rutas exclusivas del rector (`/dashboard/colegio/cursos`, `/dashboard/colegio/profesores`, `/dashboard/colegio/configuracion`, etc.), **Then** recibe 403/redirección según el proxy.
5. **Given** el proxy (`src/lib/proxy.ts`), **Then** la matriz rol × ruta queda actualizada: comité solo accede a sus 3 rutas (y APIs asociadas), rector conserva las suyas incluida `/dashboard/colegio/comite/integrantes`.

---

### User Story 3 — Escalar una alerta al comité funciona con motivo obligatorio (Priority: P1) — H01

Como rector quiero escalar una alerta individual al comité indicando el motivo, y quiero que el escalado masivo NO exista, porque escalar sin motivo caso por caso rompía con 500/400.

**Why this priority**: hallazgo H01 del CEO en prod — el flujo de escalado está roto (500 en batch, 400 en individual).

**Independent Test**: desde el listado de alertas, escalar una alerta con motivo vía modal y verificar que queda `escalada` y se crea la solicitud del comité; verificar que la barra batch no ofrece "Escalar".

**Acceptance Scenarios**:

1. **Given** el schema de batch (`alertaBatchSchema.accion`), **Then** NO admite el valor `escalada` (la API responde 400 si se envía).
2. **Given** la barra de acciones batch del listado, **Then** NO muestra el botón "Escalar".
3. **Given** una alerta individual, **When** el rector pulsa "Escalar al Comité", **Then** se abre un modal que exige motivo (mínimo 1 carácter) y al confirmar envía `POST /api/colegio/alertas/[id]/escalar` con body `{"motivo": "..."}`.
4. **Given** el POST de escalado con motivo válido, **Then** responde 200/201, la alerta queda en estado `escalada` y se crea la `SolicitudComite` correspondiente.
5. **Given** el POST de escalado sin motivo o con motivo vacío, **Then** responde 400 con mensaje claro.

---

### User Story 4 — Asignar materia a un curso acepta los ids reales de la BD (Priority: P1) — H02

Como rector quiero asignar una materia a un curso sin recibir un 400, independientemente de si la materia fue sembrada por la migración inicial o creada desde la interfaz.

**Why this priority**: hallazgo H02 — hoy toda asignación falla con 400 porque las materias sembradas por la migración tienen id UUID y el schema exige CUID.

**Independent Test**: asignar a un curso una materia sembrada por la migración (id UUID) y una materia creada desde la UI (id CUID); ambas responden 201.

**Acceptance Scenarios**:

1. **Given** una materia con id UUID (backfill de la migración `20260812052407`), **When** se envía `POST /api/colegio/cursos/[id]/materias` con su `materiaId`, **Then** responde 201.
2. **Given** una materia con id CUID (creada desde la UI), **When** se envía el mismo POST, **Then** responde 201.
3. **Given** un `materiaId` con formato inválido (ni UUID ni CUID), **Then** responde 400 con mensaje claro.
4. **Given** `cursoMateriaBodySchema`, **Then** `profesorId` sigue validando como CUID (los profesores usan CUID).

---

### User Story 5 — El dropdown de Plataforma se puebla al registrar identificador de profesor (Priority: P2) — H03

Como rector quiero que al registrar un identificador de un profesor el selector de plataforma muestre las plataformas activas, para completar el registro sin quedarme atascado.

**Why this priority**: hallazgo H03 — el dropdown aparece vacío aunque el endpoint `/api/plataformas` funciona y es público.

**Independent Test**: abrir el detalle de un profesor (`/dashboard/colegio/profesores/[id]`), iniciar el alta de un identificador y verificar que el selector de plataforma lista las plataformas activas.

**Acceptance Scenarios**:

1. **Given** el formulario de nuevo identificador de profesor, **When** se monta el componente, **Then** hace `GET /api/plataformas` y puebla el `<Select>` con las plataformas activas.
2. **Given** la respuesta del endpoint, **Then** el selector muestra al menos WhatsApp, Instagram, TikTok, Facebook, Minecraft, Telegram, Snapchat y Otra.
3. **Given** una falla del endpoint, **Then** el formulario muestra un error manejado (no un dropdown vacío silencioso).

---

### User Story 6 — Las estadísticas del colegio muestran el desglose por tipo de sujeto (Priority: P2) — H04

Como rector quiero ver en Estadísticas cuántas alertas corresponden a estudiantes, profesores y acudientes, para entender dónde se concentra el riesgo.

**Why this priority**: hallazgo H04 — el modelo ya soporta `tipoSujeto` (SPEC-165) pero las estadísticas no lo muestran.

**Independent Test**: abrir `/dashboard/colegio/estadisticas` y verificar que el desglose ESTUDIANTE/PROFESOR/ACUDIENTE es visible y sus números cuadran con las alertas del colegio.

**Acceptance Scenarios**:

1. **Given** el DTO `EstadisticasInteligenciaColegio`, **Then** incluye `alertasPorTipoSujeto: { ESTUDIANTE: number, PROFESOR: number, ACUDIENTE: number }`.
2. **Given** `GET /api/colegio/estadisticas`, **Then** la respuesta JSON incluye `alertasPorTipoSujeto` con los conteos del colegio autenticado (aislamiento por `colegioId`).
3. **Given** la vista de estadísticas, **Then** muestra el desglose de forma visible (tarjetas o sección propia).

---

### User Story 7 — Onboarding completado muestra un resumen amable (Priority: P3) — H05

Como rector cuyo colegio ya completó la configuración quiero ver un resumen de lo ya configurado al entrar a `/dashboard/colegio/onboarding`, en lugar de una pantalla vacía sin acción.

**Why this priority**: hallazgo H05 — con `estado === "completado"` la pantalla queda vacía; es menor pero da mala impresión.

**Independent Test**: con un colegio en estado completado, abrir `/dashboard/colegio/onboarding` y verificar que muestra el resumen con CTA a Inicio.

**Acceptance Scenarios**:

1. **Given** un colegio con `estado === "completado"`, **When** el rector abre `/dashboard/colegio/onboarding`, **Then** ve un mensaje tipo "Tu colegio ya está configurado" con conteos (N estudiantes, M cursos…) y un CTA a `/dashboard/colegio`.
2. **Given** un colegio con estado distinto de completado, **Then** el asistente se comporta como hoy (sin regresión).

---

### User Story 8 — El listado de alertas tiene las acciones exactas del flujo (Priority: P1) — H06

Como rector quiero en cada alerta solo 3 acciones — Revisar, Resolver aquí y Escalar al Comité — y en la selección múltiple solo "Revisar en lote", para no confundirme con acciones que no son mías (asignar, cerrar).

**Why this priority**: hallazgo H06 — la barra actual mezcla acciones del comité (Cerrar) y acciones que el brief retiró (Asignar/Reasignar/Desasignar), generando errores y ruido.

**Independent Test**: abrir `/dashboard/colegio/alertas` y verificar los botones visibles por alerta y en la barra batch, los tooltips de los chips de estado y que "Resolver aquí" escribe en la bitácora del caso.

**Acceptance Scenarios**:

1. **Given** una tarjeta de alerta del rector, **Then** muestra exactamente 3 acciones: "Revisar" (nueva → vista), "Resolver aquí" (modal de bitácora → gestionada, escribe en `SeguimientoCaso`), "Escalar al Comité" (modal de motivo → escalada + `SolicitudComite`).
2. **Given** la barra batch, **Then** muestra solo "Revisar en lote" (marca N alertas como vistas); NO muestra Escalar, Cerrar, Asignar ni Desasignar.
3. **Given** el listado del rector, **Then** NO muestra las acciones Asignar, Reasignar, Desasignar ni Cerrar (cerrar es exclusivo del comité desde su bandeja).
4. **Given** los chips de estado (nueva/vista/gestionada/escalada/cerrada), **Then** cada uno tiene tooltip en lenguaje claro (ej. "Gestionada = la resolví yo en el colegio, sin comité").
5. **Given** "Resolver aquí" con la bitácora diligenciada, **Then** la alerta pasa a `gestionada` y la nota queda registrada en el `SeguimientoCaso` del caso (SPEC-159).

---

### Edge Cases

- Escalar una alerta ya `escalada` o `cerrada`: la API rechaza con 409/400 y mensaje claro; la UI no ofrece la acción.
- Batch con mezcla de estados: "Revisar en lote" solo afecta las alertas en estado `nueva`.
- Colegio sin comité de convivencia creado: el item Usuarios → Comité de convivencia permite crearlo (flujo actual de creación de cuenta), la home del comité no aplica hasta que exista el usuario comité.
- Colegio sin alertas: el desglose por tipoSujeto muestra ceros, no error.
- Materia con id de longitud/formato arbitrario: 400 controlado, nunca 500.
- Rector que entra directo a `/dashboard/colegio/comite` (ruta movida): redirige a `/dashboard/colegio/comite/integrantes` o responde la home del comité solo si el rol es comité.
- Usuario comité que intenta `/dashboard/colegio/comite/integrantes`: 403 (administrar el comité es del rector).

## Requirements *(mandatory)*

### Functional Requirements

**Bloque A — Navegación por rol**

- **FR-001**: El sistema DEBE mostrar al rol SCHOOL_ADMIN un menú de exactamente 8 items: Inicio, Estadísticas, Alertas, Cursos, Casos comité, Usuarios (expandible: Profesores, Comité de convivencia), Configuración, Auditoría.
- **FR-002**: El sistema DEBE retirar del menú del rector los items Onboarding, Materias y Subir lista, manteniendo sus rutas accesibles por URL directa.
- **FR-003**: El sistema DEBE mover la administración del comité (creación de cuenta + gestión de integrantes) de `/dashboard/colegio/comite` a `/dashboard/colegio/comite/integrantes`.
- **FR-004**: El sistema DEBE mostrar al rol COMITE_CONVIVENCIA un menú propio de exactamente 3 items: Inicio (`/dashboard/colegio/comite`), Estadísticas (`/dashboard/colegio/comite/estadisticas`), Gestión casos (`/dashboard/colegio/comite/casos`).
- **FR-005**: El sistema DEBE implementar la nueva home del comité con resumen de casos abiertos, pendientes propios y SLA, sin contenido de reportes ni datos del denunciante.
- **FR-006**: El sistema DEBE implementar `/dashboard/colegio/comite/estadisticas` con casos por estado, tiempo medio de resolución y categorías más escaladas, sin contenido de reportes ni datos del denunciante.
- **FR-007**: El sistema DEBE actualizar `src/lib/proxy.ts` para que el comité no acceda a rutas del rector ni el rector a las exclusivas del comité, y para reflejar la ruta movida de integrantes.
- **FR-008**: El nodo "Usuarios" del menú del rector DEBE ser un padre expandible siguiendo el patrón existente de AdminNav (specs/129).

**Bloque B — Fixes H01-H06**

- **FR-009**: `alertaBatchSchema.accion` NO DEBE admitir `escalada`; la API batch DEBE responder 400 si se solicita escalar en lote.
- **FR-010**: La acción individual "Escalar al Comité" DEBE abrir un modal con motivo obligatorio (mínimo 1 carácter) y enviar `POST /api/colegio/alertas/[id]/escalar` con `{"motivo": "..."}`; sin motivo, 400.
- **FR-011**: `cursoMateriaBodySchema.materiaId` DEBE aceptar tanto ids UUID (materias sembradas por la migración) como ids CUID (materias creadas por la app); `profesorId` sigue siendo CUID.
- **FR-012**: El formulario de registro de identificador de profesor DEBE cargar `GET /api/plataformas` al montar y poblar el selector con las plataformas activas, con manejo de error visible si falla.
- **FR-013**: El DTO `EstadisticasInteligenciaColegio` DEBE incluir `alertasPorTipoSujeto` con conteos por ESTUDIANTE/PROFESOR/ACUDIENTE del colegio autenticado, y la vista de estadísticas DEBE mostrarlo.
- **FR-014**: La página de onboarding con `estado === "completado"` DEBE renderizar un resumen amable con conteos del colegio y un CTA a `/dashboard/colegio`.
- **FR-015**: La barra de acciones individual del rector DEBE mostrar exactamente Revisar, Resolver aquí y Escalar al Comité; la barra batch DEBE mostrar solo "Revisar en lote".
- **FR-016**: El sistema DEBE retirar del rector las acciones Asignar, Reasignar, Desasignar y Cerrar sobre alertas (cerrar queda exclusivo del comité).
- **FR-017**: "Resolver aquí" DEBE registrar la nota en el `SeguimientoCaso` del caso y pasar la alerta a `gestionada`.
- **FR-018**: Los chips de estado DEBEN tener tooltip explicativo en lenguaje no técnico.

**Invariantes**

- **FR-019**: En NINGUNA vista tocada el rector ni el comité ven contenido íntegro de reportes ni datos del denunciante.
- **FR-020**: Todo acceso a datos DEBE mantener aislamiento por `colegioId` (tenant-first).
- **FR-021**: Toda mutación crítica (escalar, resolver, cambios de admin del comité) DEBE registrar `AuditLog` con metadatos, sin texto de reportes.

### Key Entities

- **AlertaColegio**: alerta generada por umbral de reportes; estados nueva/vista/gestionada/escalada/cerrada; `tipoSujeto` (ESTUDIANTE/PROFESOR/ACUDIENTE); se escala con motivo a SolicitudComite.
- **SolicitudComite**: caso escalado al comité de convivencia; nace del escalado con motivo (H01).
- **SeguimientoCaso**: bitácora del caso donde "Resolver aquí" escribe la nota de gestión (SPEC-159).
- **Materia / CursoMateria**: catálogo configurable por colegio y su vínculo con el curso; ids de Materia mixtos (UUID del backfill de migración + CUID de la app).
- **NavItem / ModuloPermisible**: ítems de menú mapeados a módulos permisibles; el menú se filtra por rol y permisos (spec 086).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El menú del rector renderiza exactamente 8 items y el del comité exactamente 3, verificable por inspección visual y por test estructural del arreglo de navegación.
- **SC-002**: Escalar una alerta individual con motivo responde 200/201 el 100% de las veces; el batch con acción `escalada` responde 400 el 100% de las veces.
- **SC-003**: Asignar materia responde 201 tanto con materias sembradas (UUID) como con creadas por UI (CUID).
- **SC-004**: El selector de plataforma del identificador de profesor muestra ≥ 8 plataformas activas sin intervención manual.
- **SC-005**: `GET /api/colegio/estadisticas` incluye `alertasPorTipoSujeto` y la vista lo muestra sin errores de render.
- **SC-006**: Onboarding en estado completado deja de renderizar pantalla vacía: muestra resumen + CTA.
- **SC-007**: El listado de alertas muestra 3 acciones individuales y 1 batch, verificable visualmente y por tests de componente.
- **SC-008**: Gate de calidad completo verde (tsc, lint, arch:check, tests, build) en una sola corrida de CI del PR consolidado.

## Assumptions

- La navegación cerrada por el CEO es definitiva: 8 items rector, 3 items comité; no se discuten conteos ni etiquetas.
- Las rutas retiradas del menú (Onboarding, Materias, Subir lista) permanecen accesibles por URL; no se eliminan páginas.
- **Ids de Materia mixtos (decisión a validar en compuerta)**: la migración `20260812052407` sembró materias con `gen_random_uuid()` y la app crea nuevas con `@default(cuid())`; el fix de H02 acepta AMBOS formatos en el schema de validación (el instructivo menciona UUID, que cubre el caso del CEO, pero un uuid-only rompería las materias CUID creadas desde la UI). No se cambia el modelo de datos.
- El rol comité solo existe si el rector creó la cuenta del comité; la home del comité asume el rol autenticado.
- El modal de escalado escribe el motivo y crea la SolicitudComite con la lógica ya existente (SPEC-168); no se rediseña el modelo del comité.
- "Resolver aquí" reusar el Modal/bitácora de SeguimientoCaso existente (SPEC-159), sin nueva entidad.
- Los cambios de proxy se reflejan en `docs/architecture/` regenerado (arch:check verde en el mismo PR).
