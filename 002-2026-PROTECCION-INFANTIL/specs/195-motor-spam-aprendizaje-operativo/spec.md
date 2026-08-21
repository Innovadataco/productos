# Feature Specification: SPEC-195 — Motor SPAM + Aprendizaje operativo (002-PI-089)

**Feature Branch**: `work/002-pi-089`

**Created**: 2026-08-21

**Status**: `PLANEADO`

**Input**: 002-PI-089. El motor no clasifica SPAM (falso negativo RPT-0T6G3Z), el RAG está desconectado sin datos y el histórico humano no acelera decisiones. Se agrega rúbrica SPAM, caché semántico humano exacto, detección de patrón coordinado, flujo operativo integrado en la bandeja del operador, panel de análisis y retroalimentación al motor.

Objetivo: reducir latencia y errores del motor sobre spam, cerrar el ciclo de aprendizaje operativo y dar visibilidad al equipo sin debilitar el anti-abuso vigente.

Impacto en arquitectura: nuevos helpers en `src/lib/ai/`, cambios en `src/lib/dal/services/reporte-processing/index.ts`, nuevo endpoint `POST /api/admin/reportes/[id]/resolver-spam`, rediseño de `/dashboard/admin/spam` como panel de análisis, 9 parámetros nuevos en `prisma/seed.ts`. Bloque C (RAG activo) retirado tras evaluación honesta en ARQ_08. Cero migraciones de base de datos; se reutilizan tablas existentes.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rúbrica SPAM en el motor (Priority: P1)

Como administrador quiero que el motor reconozca reportes de spam/publicidad con una rúbrica propia, para que casos como RPT-0T6G3Z no se clasifiquen erróneamente como acoso.

**Why this priority**: cierra el hueco funcional central de la SPEC y el falso negativo verificado en producción.

**Independent Test**: un reporte con texto tipo RPT-0T6G3Z se clasifica como `SPAM` con confianza ≥ 0.7.

**Acceptance Scenarios**:

1. **Given** el parámetro `ia.rubrica.preguntas` sembrado con el bloque SPAM, **When** un admin abre `/admin/ia?tab=rubrica`, **Then** ve las 5 preguntas de la categoría SPAM.
2. **Given** un reporte con texto de estafa masiva con URL, teléfono y oferta de dinero, **When** el motor clasifica, **Then** la categoría es `SPAM` y la confianza es ≥ 0.7.
3. **Given** un reporte con conducta de acoso real, **When** el motor clasifica, **Then** la categoría SPAM no oculta la conducta grave (severidad 0 en desempate).

### User Story 2 — Caché semántico humano exacto (Priority: P1)

Como sistema quiero heredar la clasificación de reportes idénticos ya confirmados por humanos, para reducir latencia y propagar las correcciones sin gastar modelos.

**Why this priority**: baja latencia a 0 ms en hits exactos y alimenta el motor con decisiones humanas.

**Independent Test**: dos reportes con texto exacto y distintos identificadores → el segundo hereda la categoría del primero con `modeloUsado="cache:humano:<id>"`.

**Acceptance Scenarios**:

1. **Given** un reporte `CORREGIDO` con `CorreccionAdmin` confirmada y embedding, **When** llega un segundo reporte con texto ≥ 0.98 de similitud y sin activar anti-abuso, **Then** se clasifica por caché y se salta el motor.
2. **Given** un reporte que dispara ráfaga (`esRafaga=true`), **When** busca en caché, **Then** NO se aplica caché y sigue al motor.
3. **Given** un reporte marcado `DUPLICADO`, **When** busca en caché, **Then** NO se aplica caché.
4. **Given** un reporte con texto similar pero similitud < 0.98, **When** busca en caché, **Then** es miss y sigue al motor.

### User Story 3 — Detección de patrón coordinado (Priority: P1)

Como operador quiero que el sistema detecte cuando el mismo texto se reporta contra muchos identificadores distintos en poco tiempo, para revisar posibles campañas coordinadas.

**Why this priority**: protege la integridad de la consulta pública contra ataques de spam coordinado.

**Independent Test**: 5 reportes con mismo texto contra 5 identificadores distintos en < 60 min → los 5 quedan en `REVISION_MANUAL` con `prioridadAlta=true`.

**Acceptance Scenarios**:

1. **Given** ≥5 reportes con similitud ≥ 0.90 contra identificadores distintos dentro de 60 min, **When** se procesa cada uno, **Then** se marca como patrón coordinado y se fuerza `REVISION_MANUAL`.
2. **Given** un patrón coordinado detectado, **When** se finaliza el procesamiento, **Then** se crea/registra un `IncidenteInfra` con señal `patron_coordinado:<hash-texto>` y se alerta a admin.
3. **Given** reportes contra el mismo identificador (duplicado/ráfaga), **When** se evalúa patrón coordinado, **Then** no se consideran como parte del patrón.

### User Story 4 — Flujo operativo integrado en bandeja (Priority: P1)

Como operador quiero resolver reportes spam desde la bandeja normal, con 3 decisiones claras, para no trabajar en una cola aparte.

**Why this priority**: elimina la cola `/admin/spam` como lugar de trabajo y unifica la operación.

**Independent Test**: `POST /api/admin/reportes/[id]/resolver-spam` con cada decisión actualiza estado, audit log y dataset según corresponda.

**Acceptance Scenarios**:

1. **Given** un reporte en `POSIBLE_SPAM`, **When** el operador decide `es_spam`, **Then** pasa a `DADO_DE_BAJA`, se crea `DatasetEntrenamiento` SPAM y se genera embedding en `EmbeddingDataset`.
2. **Given** un reporte en `POSIBLE_SPAM`, **When** el operador decide `corregir` a una categoría real, **Then** se crea `CorreccionAdmin`, pasa a `CLASIFICADO` y se genera embedding con la corrección.
3. **Given** un reporte en `POSIBLE_SPAM`, **When** el operador decide `procesar_como_acoso`, **Then** mantiene la categoría original del motor, pasa a `CLASIFICADO` y sigue el flujo normal.
4. **Given** un reporte `POSIBLE_SPAM` sin resolver después de `spam.sla_horas`, **When** corre el job de SLA, **Then** se envía alerta al admin.

### User Story 5 — Panel de análisis de spam (Priority: P1)

Como administrador quiero un panel de análisis de spam con métricas y distribución, para entender qué confunde el motor y curar el banco de evaluación.

**Why this priority**: cierra H2/H4 de ARQ_08 y da visibilidad del aprendizaje operativo.

**Independent Test**: `/api/admin/spam/analitica` devuelve métricas 7/30/90 días, serie temporal y distribución por categoría original.

**Acceptance Scenarios**:

1. **Given** reportes confirmados/corregidos/pendientes en distintas ventanas, **When** se consulta el panel, **Then** se muestran las tarjetas correctas.
2. **Given** casos donde el humano corrigió hacia SPAM, **When** se muestra la distribución, **Then** se ve la categoría original que dio el motor.
3. **Given** un caso confirmado como spam, **When** el admin hace clic en "Sugerir al banco", **Then** se copia al portapapeles una línea JSONL compatible con `fixtures/banco-curado-v2.jsonl`.

### User Story 6 — Retroalimentación al motor (Priority: P2)

Como sistema quiero que cada corrección humana alimente `DatasetEntrenamiento` y `EmbeddingDataset`, para que el caché/RAG futuro tenga ejemplos reales.

**Why this priority**: cierra el ciclo de aprendizaje; es prerequisito para que el caché y un futuro RAG funcionen.

**Independent Test**: al corregir "no era spam, es solicitud_material" se crea una fila `DatasetEntrenamiento` con `clasificacionCorrecta=SOLICITUD_MATERIAL`.

**Acceptance Scenarios**:

1. **Given** una corrección hacia SPAM, **When** se resuelve, **Then** se genera embedding con `clasificacionCorrecta=SPAM`.
2. **Given** una corrección desde SPAM hacia otra categoría de acoso, **When** se resuelve, **Then** se genera embedding con la categoría real.

### User Story 7 — Notificación al denunciante al cerrar spam (Priority: P2)

Como denunciante autenticado quiero recibir un email cuando mi reporte se confirma como spam, para saber que no cuenta en estadísticas públicas.

**Why this priority**: transparencia con el usuario final; los anónimos no tienen destinatario.

**Independent Test**: confirmar spam de un reporte autenticado dispara envío de email (log/mock).

**Acceptance Scenarios**:

1. **Given** un reporte con `usuarioId`, **When** un operador confirma spam, **Then** se envía email al denunciante con texto configurable y neutral.
2. **Given** un reporte anónimo, **When** se confirma spam, **Then** no se envía email ni se produce error.
3. **Given** `spam.notificacion.enabled=false`, **When** se confirma spam, **Then** no se envía email.

### User Story 8 — Documentación del modelo (Priority: P2)

Como auditor quiero que la documentación del modelo refleje SPAM y el caché humano, para mantener alineado diseño y código.

**Why this priority**: requisito de gobierno; cierra deuda de "spam sin rúbrica" y "RAG desconectado".

**Independent Test**: `IaDocsPanel.tsx` incluye `SPAM` en el catálogo; `MODELO-DE-CLASIFICACION.md` actualiza §5/§8/§9/§14.

**Acceptance Scenarios**:

1. **Given** el panel de documentación IA, **When** se listan categorías, **Then** aparece `SPAM: "Spam"`.
2. **Given** el documento `MODELO-DE-CLASIFICACION.md`, **When** se lee §8, **Then** SPAM figura como categoría interna sin visibilidad pública.

### User Story 9 — Parámetros configurables (Priority: P2)

Como administrador quiero poder configurar umbrales de caché, patrón coordinado, SLA y notificación sin desplegar código.

**Why this priority**: ADR_004; todo valor operativo debe ser parámetro.

**Independent Test**: `prisma/seed.ts` siembra los 9 parámetros en `monitoreoNuevos` y son leídos por los nuevos helpers.

**Acceptance Scenarios**:

1. **Given** una instalación limpia, **When** corre `npx prisma db seed`, **Then** existen `motor.cache.similitud_umbral=0.98`, `patron_coordinado.min_reportes=5`, `spam.sla_horas=48`, `scoring.severity.spam=0`, etc.
2. **Given** el admin cambia `spam.sla_horas`, **When** corre el job de SLA, **Then** usa el nuevo valor.

---

## Edge Cases

- **Caché con reporte origen eliminado**: el caché busca en `Reporte` + `EmbeddingReporte`; si el origen fue dado de baja, el embedding puede persistir. Se excluyen estados que no sean `CORREGIDO` (o `CLASIFICADO` si el flag lo permite).
- **Anti-abuso gana siempre**: ráfaga o duplicado cortan a revisión manual sin caché, incluso si existe un hit exacto.
- **Patrón coordinado incluso con caché hit**: si un reporte hereda categoría por caché pero luego detecta patrón coordinado, se fuerza a `REVISION_MANUAL`.
- **Operador no asignado**: el endpoint `resolver-spam` rechaza con 403 si el rol es OPERADOR y no es el asignado.
- **Spam confirmado sin denunciante**: el email se salta silencioso si no hay `usuarioId`.
- **Dataset vacío**: el caché devuelve miss sin error; el sistema sigue con el motor.
- **Modelo de embedding distinto entre origen y nuevo reporte**: la similitud coseno es comparable solo si el modelo es el mismo. El helper filtra por `modeloUsado` del embedding actual o acepta el riesgo documentado.
- **IncidenteInfra duplicado**: si ya existe un incidente abierto para `patron_coordinado:<hash-texto>`, no se crea otro; se reutiliza y se actualiza `detalle` con los nuevos reportes relacionados.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir el bloque `SPAM` con 5 preguntas en `src/lib/ai/rubrica-semilla.ts` y sembrarlo vía `ia.rubrica.preguntas` en `prisma/seed.ts`.
- **FR-002**: El sistema DEBE añadir `scoring.severity.spam=0` en `prisma/seed.ts` para que SPAM pierda desempates de gravedad.
- **FR-003**: El sistema DEBE crear `src/lib/ai/cache-semantico.ts` con `buscarClasificacionCache(embedding, parametros)` que consulte `EmbeddingReporte` filtrando por estado `CORREGIDO` confirmado (u opcionalmente `CLASIFICADO` con confianza ≥ 0.9) y similitud ≥ `motor.cache.similitud_umbral` (default 0.98).
- **FR-004**: El caché NUNCA DEBE aplicarse si `esRafaga=true` o el reporte está marcado `DUPLICADO`.
- **FR-005**: El sistema DEBE integrar el caché en `src/lib/dal/services/reporte-processing/index.ts` después de guardas-previas y antes del motor; en hit se debe persistir `ClasificacionIA` con `modeloUsado="cache:humano:<reporteOrigenId>"` y `latenciaMs=0`.
- **FR-006**: El sistema DEBE crear `src/lib/ai/patron-coordinado.ts` con `detectarPatronCoordinado(reporteId, embedding, parametros)` que busque reportes similares ≥ `patron_coordinado.similitud_umbral` (default 0.90) en los últimos `patron_coordinado.ventana_min` (default 60) y cuente identificadores distintos.
- **FR-007**: Si el conteo de identificadores distintos es ≥ `patron_coordinado.min_reportes` (default 5), el sistema DEBE marcar el reporte como `REVISION_MANUAL` con `prioridadAlta=true`, registrar `IncidenteInfra` con señal `patron_coordinado:<hash-texto>` y alertar admin.
- **FR-008**: El patrón coordinado DEBE integrarse después del motor/caché y DEBE forzar revisión humana incluso si el veredicto previo era claro.
- **FR-009**: El sistema DEBE crear `POST /api/admin/reportes/[id]/resolver-spam` con body `{ decision: "es_spam" | "corregir" | "procesar_como_acoso", categoria?, motivo, notificarDenunciante? }`, auth ADMIN/OPERADOR asignado y rate-limit `admin_write`.
- **FR-010**: Para `decision="es_spam"` el sistema DEBE dar de baja el reporte, crear `DatasetEntrenamiento(SPAM)`, generar embedding en `EmbeddingDataset` y notificar al denunciante si aplica.
- **FR-011**: Para `decision="corregir"` el sistema DEBE crear `CorreccionAdmin`, pasar a `CLASIFICADO` con la categoría corregida y generar embedding en `EmbeddingDataset` con la corrección.
- **FR-012**: Para `decision="procesar_como_acoso"` el sistema DEBE mantener la categoría original del motor, pasar a `CLASIFICADO` y seguir el flujo normal.
- **FR-013**: Cada decisión humana DEBE registrar `AuditLog` con acción canónica (`CASO_DADO_DE_BAJA`, `CASO_CORREGIDO`, `CASO_CONFIRMADO`).
- **FR-014**: El sistema DEBE crear un job/cron que detecte reportes `POSIBLE_SPAM` con edad > `spam.sla_horas` y alerte a admin.
- **FR-015**: El sistema DEBE rediseñar `/dashboard/admin/spam` como panel de análisis con métricas 7/30/90 días, serie temporal, distribución por categoría original, top palabras/identificadores/usuarios/plataformas, detalle por caso y botón "Sugerir al banco".
- **FR-016**: El botón "Sugerir al banco" DEBE copiar al portapapeles una línea JSONL con formato `fixtures/banco-curado-v2.jsonl`.
- **FR-017**: El sistema DEBE crear `src/lib/email/notificacion-spam.ts` para enviar email al denunciante autenticado usando el template configurable `spam.notificacion.template`.
- **FR-018**: El sistema DEBE actualizar `src/components/modules/ia/IaDocsPanel.tsx` para incluir `SPAM: "Spam"` en `CATEGORIA_LABELS` y reflejar el caché humano (RAG retirado).
- **FR-019**: El sistema DEBE actualizar `MODELO-DE-CLASIFICACION.md` en el repo de gestión (§5, §8, §9, §14).
- **FR-020**: El sistema DEBE sembrar 9 parámetros nuevos en `prisma/seed.ts` sección `monitoreoNuevos` (sin `motor.rag.activo`).

### Key Entities

- `Reporte`, `ClasificacionIA`, `CorreccionAdmin`, `DatasetEntrenamiento`, `EmbeddingReporte`, `EmbeddingDataset`, `IncidenteInfra`, `AuditLog`, `ParametroSistema`, `Usuario`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Rúbrica SPAM visible en `/admin/ia?tab=rubrica` con 5 preguntas.
- **SC-002**: Texto tipo RPT-0T6G3Z clasifica `SPAM` con confianza ≥ 0.7.
- **SC-003**: Caché hit: segundo reporte idéntico hereda clasificación con `modeloUsado="cache:humano:..."`.
- **SC-004**: Ráfaga/duplicado NO usa caché (verificable en trace).
- **SC-005**: 5 reportes coordinados → todos en `REVISION_MANUAL` con prioridad alta + `IncidenteInfra` registrado.
- **SC-006**: Endpoint `resolver-spam` funciona para las 3 decisiones con audit log.
- **SC-007**: Confirmar spam de reporte autenticado envía email (log/mock).
- **SC-008**: Panel `/dashboard/admin/spam` muestra métricas y botón "Sugerir al banco".
- **SC-009**: `IaDocsPanel.tsx` incluye SPAM; `MODELO-DE-CLASIFICACION.md` actualizado.
- **SC-010**: Gate local completo verde (tsc, lint --no-cache, arch:check, tests, build).
- **SC-011**: Cero migraciones destructivas; solo tablas existentes.

---

## Assumptions

- El motor activo es la rúbrica (`ia.rubrica.enabled=true`); SPAM se procesa como una categoría más.
- El anti-abuso vigente (rate-limit, ráfaga, duplicado, blocklist) NO se modifica.
- El RAG (`ejemplosRag`) se sigue calculando para trace pero NO se pasa al prompt del LLM.
- `EmbeddingReporte` usa el mismo modelo de embeddings para todos los reportes en una instalación dada; la similitud coseno es comparable.
- `IncidenteInfra` se usa para registrar el patrón coordinado (SPEC-184), con señal `patron_coordinado:<hash-texto>`, detalle JSON y cierre automático tras 60 min sin nuevos matches.
- El SLA de spam se revisa con el mismo scheduler/worker que otros jobs de monitoreo (`pi-monitor` / `pi-worker`).
- El endpoint `resolver-spam` reemplaza progresivamente al endpoint legado `/api/admin/spam/[id]/resolver`; el legado puede quedar deprecado.

---

## Decisiones de compuerta §4 (pendientes de aprobación)

1. **RAG activo**: CONFIRMADO retirado (Bloque C). `ejemplosRag` solo para trace; no al prompt.
2. **Precedencia anti-abuso**: caché NUNCA aplica si `esRafaga=true` o estado `DUPLICADO`.
3. **Caché solo humano-confirmado**: default `motor.cache.solo_humano_confirmado=true`; opcionalmente incluir `CLASIFICADO` con confianza ≥ 0.9 si se desactiva.
4. **Patrón coordinado**: similitud 0.90, ventana 60 min, mínimo 5 identificadores distintos. Siempre fuerza `REVISION_MANUAL` + prioridad alta.
5. **Registro de patrón coordinado**: CONFIRMADO usar `IncidenteInfra` con señal `patron_coordinado:<hash-texto>`, detalle JSON y cierre automático tras 60 min sin nuevos matches.
6. **Notificación spam**: default habilitado, template configurable, solo denunciantes autenticados.
7. **Documentación cruzada**: `MODELO-DE-CLASIFICACION.md` ya fue actualizado por ZEUS en commit 3718a23 (v1.5). Esta SPEC solo actualiza el catálogo §8 y los diagramas §3/§6 de `IaDocsPanel.tsx`/`MODELO-DE-CLASIFICACION.md` para incluir SPAM.

---

## Implementación

- Backend: helpers `src/lib/ai/cache-semantico.ts` y `src/lib/ai/patron-coordinado.ts`; integración en `src/lib/dal/services/reporte-processing/index.ts`; endpoint `POST /api/admin/reportes/[id]/resolver-spam`; servicio `src/lib/email/notificacion-spam.ts`; job SLA spam; registro de patrón coordinado vía `IncidenteInfra` (reusando `src/lib/monitoreo/incidentes.ts` / `MonitoreoRepository`).
- Frontend: rediseño de `src/components/modules/SpamRevisionPanel.tsx` y posiblemente `src/app/dashboard/admin/spam/page.tsx`; página/endpoint `/api/admin/spam/analitica`.
- Config: 9 parámetros en `prisma/seed.ts` sección `monitoreoNuevos`; bloque SPAM en `src/lib/ai/rubrica-semilla.ts`; severidad SPAM en seed.
- Docs: actualización de `src/components/modules/ia/IaDocsPanel.tsx` (catálogo §8 y diagramas §3/§6); `MODELO-DE-CLASIFICACION.md` ya actualizado por ZEUS (3718a23).
- Tests: unitarios de caché y patrón; integración del endpoint `resolver-spam`; renderizado del panel de análisis.
- Sin migraciones destructivas; sin tocar `guardas-decision.ts`, `rate-limit.ts`, `rafagas.ts`, `duplicados.ts`.

---

## Deuda técnica / Incidencias

- **I-81 (falso negativo spam)**: se cierra con la rúbrica SPAM.
- **RAG desconectado**: se documenta como deuda consciente; se reevaluará cuando `DatasetEntrenamiento` tenga datos suficientes.
- **RAG desconectado**: se documenta como deuda consciente; se reevaluará cuando `DatasetEntrenamiento` tenga datos suficientes.
- **MODELO-DE-CLASIFICACION.md**: ZEUS ya actualizó v1.5 (3718a23); esta SPEC solo ajusta catálogo/diagramas.
