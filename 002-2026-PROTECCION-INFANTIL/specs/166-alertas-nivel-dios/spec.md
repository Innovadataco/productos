# Feature Specification: SPEC-166 — Alertas nivel dios: bandeja de prioridad, filtros, lote, SLA

**Feature Branch**: `work/002-pi-0XX` (a definir al radicar; depende de `feature/001-scaffolding`)

**Created**: 2026-08-12

**Status**: PLANEADO

**Input**: [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §7 (Alertas = centro de mando "nivel dios"), §4.2 (reglas de generación de alerta), §5 (ciclo del caso), §10 (accesibilidad y rendimiento). Dependencias: SPEC-139 (`EventoMatch`), SPEC-159 (`SeguimientoCaso` / bitácora), Fase C "Alertas extendidas" (tipo de sujeto en `AlertaColegio`).

## Impacto en arquitectura:

- **API**: nuevo endpoint `/api/colegio/alertas` con ordenamiento por prioridad/novedad/SLA y filtros; respeta aislamiento `colegioId`.
- **UI**: nueva pantalla `/dashboard/colegio/alertas` (bandeja "nivel dios") y actualización de notificaciones in-app / avisos por email.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rector ve una bandeja ordenada por gravedad, novedad y SLA (Priority: P1)

Como rector (`SCHOOL_ADMIN`) quiero entrar a `/dashboard/colegio/alertas` y ver primero lo que duele más, luego lo más nuevo y luego lo que se vence primero, para saber en 3 segundos qué tengo que hacer hoy.

**Why this priority**: es el corazón del rediseño "nivel dios": el sistema decide qué importa primero, no el usuario.

**Independent Test**: con 6 alertas mezcladas (alta/media/baja, nueva/vista, SLA lejano/próximo), la bandeja se ordena exactamente por prioridad desc, novedad (nueva > vista > gestionada > escalada > cerrada) y vencimiento SLA asc.

**Acceptance Scenarios**:

1. **Given** alertas de distinta prioridad, **When** se carga la bandeja, **Then** las de prioridad `alta` aparecen antes que las `media` y estas antes que las `baja`.
2. **Given** alertas de la misma prioridad, **When** se ordenan, **Then** las `nueva` van antes que las `vista`, estas antes que `gestionada`, estas antes que `escalada` y estas antes que `cerrada`.
3. **Given** alertas de la misma prioridad y novedad, **When** se ordenan, **Then** la que tiene el `vencimientoSla` más próximo aparece primero.
4. **Given** una alerta, **When** se renderiza, **Then** se muestra chip de estado, chip de gravedad, curso/sujeto, categoría de conducta, tiempo restante de SLA y fecha de llegada — nunca el texto del reporte ni quién lo reportó.
5. **Given** una alerta cerrada o escalada, **When** se renderiza, **Then** sigue visible en la bandeja (con filtros por defecto excluibles) pero degradada en el orden.

---

### User Story 2 — Rector filtra la bandeja por sujeto, curso, categoría, gravedad y fecha (Priority: P1)

Como rector quiero reducir la bandeja a los casos que me interesan sin perder el orden de prioridad, para actuar por lotes sobre grupos concretos.

**Why this priority**: el volumen puede crecer; los filtros potentes son el contrapeso de la bandeja única frente al Kanban descartado.

**Independent Test**: un rector puede filtrar por estado `nueva`, sujeto `ESTUDIANTE`, curso `6°A`, categoría `SOLICITUD_ENCUENTRO`, gravedad `alta` y rango de fechas; los resultados respetan todos los criterios y no cruzan de colegio.

**Acceptance Scenarios**:

1. **Given** filtros por estado, sujeto, curso, categoría, gravedad, fecha desde/hasta, **When** se aplican, **Then** `GET /api/colegio/alertas` devuelve solo alertas que cumplan todos los criterios combinados.
2. **Given** un curso ajeno al colegio, **When** se envía como filtro, **Then** se recibe 404 o lista vacía (A/B según patrón del repo).
3. **Given** una categoría inexistente, **When** se filtra, **Then** se recibe 400 con mensaje claro.
4. **Given** filtros aplicados, **When** se pulsa "limpiar filtros", **Then** la bandeja vuelve al estado inicial con el orden por defecto.
5. **Given** la vista móvil, **When** se abren filtros, **Then** se presentan en un panel deslizable o acordeón accesible; los touch targets son ≥ 44 px.

---

### User Story 3 — Rector actúa sobre una alerta de forma inline (Priority: P1)

Como rector quiero, desde la misma fila, marcar una alerta como vista, gestionada, escalada o cerrada, escalarla a comité o asignarla a alguien, para no entrar al detalle cuando la acción es obvia.

**Why this priority**: "cada pantalla termina en un verbo" (BRIEF §0); cada clic extra es fricción para un usuario no técnico en el celular.

**Independent Test**: una alerta `nueva` se marca `vista`, luego `gestionada`, luego `escalada` y finalmente `cerrada`; cada transición se refleja inmediatamente en la bandeja, genera `AuditLog` y respeta el tenant.

**Acceptance Scenarios**:

1. **Given** una alerta en estado `nueva`, **When** se pulsa "Marcar vista", **Then** pasa a `vista`, la UI actualiza el chip y el orden se recalcula.
2. **Given** una alerta `vista`, **When** se pulsa "Gestionar", **Then** abre `/dashboard/colegio/alertas/[id]` (SPEC-159) y, al cerrar, la bandeja refleja el nuevo estado si se cambió.
3. **Given** una alerta, **When** se pulsa "Escalar a comité", **Then** se crea una `SolicitudComite` para el reporte, la alerta pasa a `escalada` y se audita `COLEGIO_ALERTA_ESCALADA`.
4. **Given** una alerta, **When** se pulsa "Asignar", **Then** se selecciona un usuario responsable, se persiste `asignadoAId` en la alerta y se audita `COLEGIO_ALERTA_ASIGNADA`.
5. **Given** una alerta de otro colegio, **When** se intenta cualquier acción, **Then** se recibe 404 sin mutación.

---

### User Story 4 — Rector actúa en lote sobre varias alertas (Priority: P1)

Como rector quiero seleccionar varias alertas y aplicarles la misma acción (gestionar/escalar/asignar), para ganar tiempo en picos de volumen.

**Why this priority**: la eficiencia en lote es parte de "nivel dios": la herramienta debe sentirse poderosa sin ser abrumadora.

**Independent Test**: se seleccionan 3 alertas `nueva` y se marcan `vista` en lote; solo las del colegio actual cambian, la respuesta indica cuántas se procesaron y ninguna ajena se ve afectada.

**Acceptance Scenarios**:

1. **Given** una selección de N alertas, **When** se elige "Marcar como gestionadas" en lote, **Then** todas pasan a `gestionada` (solo las que estaban en estados previos válidos), la UI muestra el conteo y se registra un solo `AuditLog` de lote.
2. **Given** una selección mixta con una alerta ajena al colegio, **When** se aplica una acción en lote, **Then** la ajena se ignora/silencia con 404 individual y las demás se procesan.
3. **Given** cero alertas seleccionadas, **When** se intenta una acción en lote, **Then** el botón está deshabilitado o devuelve 400.
4. **Given** una acción de escalamiento en lote, **When** se confirma, **Then** se crea una `SolicitudComite` por cada reporte distinto afectado (idempotente por `reporteId` único) y las alertas pasan a `escalada`.

---

### User Story 5 — Rector recibe contexto EventoMatch para decidir escalar (Priority: P2)

Como rector quiero ver, junto a una alerta, cuando el identificador ya tiene reportes independientes acumulados, para priorizar el escalamiento al comité.

**Why this priority**: `EventoMatch` es la evidencia de reincidencia; sin mostrarla, el rector pierde la señal más fuerte de riesgo.

**Independent Test**: una alerta cuyo reporte tiene un `EventoMatch` con `conteoAcumulado = 3` muestra el badge "3 reportes independientes" y un botón contextual para escalar; una alerta sin match no muestra el badge.

**Acceptance Scenarios**:

1. **Given** un `EventoMatch` con `conteoAcumulado >= 2`, **When** se lista la bandeja, **Then** la alerta correspondiente muestra un badge con el conteo y un indicador de reincidencia (inter-ciudad si aplica).
2. **Given** el badge de reincidencia, **When** se pulsa "Escalar", **Then** se prellena la acción de escalamiento con el motivo sugerido "Reincidencia confirmada por múltiples reportes independientes".
3. **Given** una alerta sin `EventoMatch`, **When** se renderiza, **Then** no aparece badge ni conteo inventado.
4. **Given** el contexto del match, **When** se inspecciona la respuesta de la API, **Then** no incluye ciudades detalladas, identidades ni textos de reportes — solo el conteo agregado y el flag inter-ciudad (FR-009 de SPEC-139).

---

### Edge Cases

- **Alerta sin clasificación**: se considera gravedad `baja` hasta que el reporte se clasifique; si después el reporte cambia, se recalcula prioridad/SLA.
- **Reporte eliminado**: la alerta se excluye del listado por defecto (`reporte.eliminado = false`), aunque exista histórica.
- **SLA vencido**: se muestra en rojo/rubí con texto "SLA vencido"; sigue ordenándose antes que el no vencido de igual prioridad.
- **Cross-tenant en lote**: si un `id` de otro colegio se cuela en la petición (manipulación del front), el backend lo ignora silenciosamente con 404 individual; nunca muta datos ajenos.
- **Escalamiento duplicado**: `SolicitudComite.reporteId` es `@unique`; un segundo escalamiento del mismo reporte devuelve 409 y no duplica la solicitud.
- **Asignación a usuario ajeno**: solo se permiten usuarios del mismo `colegioId` o roles de plataforma con acceso al colegio; cualquier otro devuelve 404.
- **Fase C no entregada**: si el campo `tipoSujeto` no existe, el filtro por sujeto se limita a `ESTUDIANTE` y se documenta como deuda (Assumptions).
- **Reduced motion**: las animaciones de cambio de estado respetan `prefers-reduced-motion`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extender los estados de `AlertaColegio` a: `nueva`, `vista`, `gestionada`, `escalada`, `cerrada` (String con valores cerrados, migración aditiva sin tocar `Curso` ni `Estudiante.cursoId`).
- **FR-002**: El sistema DEBE añadir a `AlertaColegio` los campos `prioridad` (`alta` | `media` | `baja`), `vencimientoSla` (`DateTime`) y `asignadoAId` (`String?` FK a `Usuario.id`).
- **FR-003**: El sistema DEBE calcular `prioridad` y `vencimientoSla` al crear la alerta y ofrecer recálculo cuando cambia la clasificación o se detecta un `EventoMatch`. El cálculo usa categoría de conducta, confianza, `posibleAgresorPar`, `EventoMatch.conteoAcumulado` e `interCiudad`.
- **FR-004**: El sistema DEBE exponer `GET /api/colegio/alertas` con filtros (`estado`, `tipoSujeto`, `cursoId`, `categoria`, `gravedad`, `desde`, `hasta`), paginación estándar (`page`/`pageSize`, default 25, máx 100) y orden fijo por prioridad + novedad + SLA.
- **FR-005**: El sistema DEBE rediseñar `/dashboard/colegio/alertas` como bandeja de prioridad tipo lista (no Kanban), con chips de estado, filtros potentes, selección en lote y acciones inline.
- **FR-006**: El sistema DEBE permitir acciones inline: cambiar estado (`PATCH /api/colegio/alertas/[id]/estado`), escalar a comité (`POST /api/colegio/alertas/[id]/escalar`) y asignar responsable (`POST /api/colegio/alertas/[id]/asignar`).
- **FR-007**: El sistema DEBE permitir acciones en lote (`POST /api/colegio/alertas/batch`) sobre una selección de alertas, con acciones `gestionar`, `escalar`, `asignar`.
- **FR-008**: El sistema DEBE mostrar contexto `EventoMatch` en la bandeja cuando el reporte de la alerta tiene un match: conteo acumulado e indicador inter-ciudad, sin exponer ciudades detalladas, identidades ni textos.
- **FR-009**: El sistema DEBE mantener el aislamiento por `colegioId` en todas las lecturas y mutaciones; nunca exponer el contenido del reporte ni la identidad del denunciante.
- **FR-010**: El sistema DEBE auditar las mutaciones con acciones `COLEGIO_ALERTA_ESTADO`, `COLEGIO_ALERTA_ESCALADA`, `COLEGIO_ALERTA_ASIGNADA` y `COLEGIO_ALERTA_LOTE_*`; los `AuditLog` contienen solo metadatos.
- **FR-011**: El sistema DEBE realizar una migración de BD puramente aditiva: añade columnas/índices a `AlertaColegio`; no modifica `Curso`, `Estudiante` ni sus relaciones.

### Key Entities

- **`AlertaColegio`** (modificado aditivamente): estados `nueva | vista | gestionada | escalada | cerrada`; campos `prioridad`, `vencimientoSla`, `asignadoAId`.
- **`SolicitudComite`**: reusado para el escalamiento al comité de validación de la plataforma; no se modifica.
- **`SeguimientoCaso` / `NotaSeguimiento`**: reusados para la bitácora al gestionar; no se modifica.
- **`EventoMatch`**: leído por `reporteId` para contexto de reincidencia; no se modifica.
- **`Usuario`**: destino de `asignadoAId`; no se modifica.

---

## Success Criteria *(mandatory)*

- **SC-001**: Una bandeja con 200 alertas carga y ordena en < 500 ms (medido en el endpoint).
- **SC-002**: El 100% de las operaciones (lista, filtros, acciones inline, acciones en lote) respetan el aislamiento por `colegioId` (tests A/B).
- **SC-003**: Todos los filtros (estado, sujeto, curso, categoría, gravedad, fecha) funcionan de forma individual y combinada.
- **SC-004**: Las acciones en lote procesan solo alertas del colegio actual; informan cuántas se mutaron y cuántas fallaron sin exponer datos ajenos.
- **SC-005**: El contexto `EventoMatch` aparece solo cuando existe match; nunca inventa conteos ni expone datos sensibles.
- **SC-006**: La UI cumple accesibilidad: touch targets ≥ 44 px, contraste AA, navegación por teclado, `prefers-reduced-motion` y roles ARIA correctos en la tabla/lista.
- **SC-007**: Gates verdes: `npx tsc --noEmit`, `npm run lint`, `npm run arch:check`, `npm run test`, `npm run build`.

---

## Impacto en arquitectura

- **Modelo de datos**: migración aditiva sobre `AlertaColegio` (estados extendidos + `prioridad` + `vencimientoSla` + `asignadoAId` + índices). No se tocan `Curso`, `Estudiante`, `Profesor`, `AcudienteEstudiante`, `IdentificadorEstudiante`, `Reporte`, `ClasificacionIA` ni `EventoMatch`.
- **DAL**: extensión de `AlertaColegioRepository` para listado filtrado/ordenado, asignación y recálculo de prioridad; nuevo servicio `alertas-prioridad.ts`.
- **API**: `GET /api/colegio/alertas` ampliado; `PATCH /api/colegio/alertas/[id]/estado` con estados extendidos; `POST /api/colegio/alertas/[id]/escalar`; `POST /api/colegio/alertas/[id]/asignar`; `POST /api/colegio/alertas/batch`.
- **UI**: rediseño completo de `/dashboard/colegio/alertas` (page + client), componentes de filtros, chips, selección en lote y badge de reincidencia.
- **Auditoría**: ampliación del enum `AccionAudit` con `COLEGIO_ALERTA_ESCALADA`, `COLEGIO_ALERTA_ASIGNADA` y `COLEGIO_ALERTA_LOTE_*`.
- **Arquitectura**: la línea base generada (`docs/architecture/`) se regenera para reflejar cambios en modelo, rutas y página (`npm run arch:check` verde).

---

## Assumptions

- Fase C "Alertas extendidas" entrega `AlertaColegio` con discriminación de tipo de sujeto (`ESTUDIANTE` | `PROFESOR` | `ACUDIENTE`). Si aún no está disponible, el filtro por sujeto se limita a `ESTUDIANTE` y se documenta como deuda técnica.
- El escalamiento "a comité" en esta fase apunta al Comité de Validación de la plataforma (rol `COMITE_VALIDACION`) usando `SolicitudComite`. El Comité de Convivencia colegio-scoped es objeto de la Fase F.
- El cálculo inicial de gravedad usa categoría de `ClasificacionIA`, `confianza`, `posibleAgresorPar` y `EventoMatch`. Los pesos exactos se definen en `ParametroSistema` con valores por defecto seguros.
- Los valores de SLA por gravedad son: `alta` = 24 h, `media` = 48 h, `baja` = 72 h. Son configurables por colegio vía `ParametroSistema`.
- No se procesa ni almacena multimedia; la bandeja muestra solo metadatos de texto.
- Los tests de API usan el patrón existente (handler importado, seed en `beforeAll`, cleanup en `afterAll`).
