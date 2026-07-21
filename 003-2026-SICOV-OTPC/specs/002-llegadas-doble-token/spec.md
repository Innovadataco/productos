# Feature Specification: Registro de una llegada con doble token

**Feature Branch**: `[002-llegadas-doble-token]`

**Created**: 2026-07-21

**Status**: PLANEADO — MODO PLAN, gate humano antes de implementar

**Input**: User description: "Segunda feature del 003. Reutiliza el patrón del despacho (feature 001-US2): reporte a Supertransporte con doble token (3 cabeceras), worker table-driven sobre la tabla de solicitudes, estados/reintentos, reintento manual. Registro de una llegada (arribo de un vehículo a terminal destino) persistido en `tbl_llegadas_solicitudes` y reportado por el worker. Endpoint de registro + KPI de llegadas en el dashboard + listado paginado. Guardarraíl: INTEGRACIONES_MODO=stub, cero APIs reales hasta verificación humana."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar y reportar una llegada con doble token (Priority: P1)

Una empresa vigilada (o su operador rol 3) registra la **llegada** (arribo) de un vehículo a la terminal destino, opcionalmente asociada a un despacho previo. El sistema encola la solicitud en `tbl_llegadas_solicitudes` y un **worker table-driven** la reporta a la Superintendencia de Transporte con las **tres cabeceras** del doble token, exactamente como el flujo de despachos.

**Why this priority**: Las llegadas cierran el ciclo operativo salida→arribo y son el segundo reporte transaccional del sistema. Reutilizan todo el andamiaje del despacho (cliente doble token, worker, estados), por lo que consolidan el patrón y lo prueban en un segundo dominio.

**Independent Test**: Con un vigilado autenticado y modo stub, se registra una llegada; el worker envía el POST con las 3 cabeceras correctas al endpoint de llegadas; la solicitud pasa de pendiente a procesada guardando `id_llegada_externo` y la respuesta; un fallo controlado la deja reintentable con contador correcto.

**Acceptance Scenarios**:

1. **Given** un vigilado autenticado, **When** registra una llegada (payload con `placa`, `tipo_llegada`, opcional `id_despacho`), **Then** el sistema persiste la solicitud en `tbl_llegadas_solicitudes` con `estado='pendiente'`, `procesado=false`, `nit_vigilado`, `usuario_id`, `rol_id`, `placa`, `tipo_llegada`.
2. **Given** una solicitud encolada, **When** el worker la toma, **Then** arma las 3 cabeceras (`Authorization: Bearer <tokenExterno>`, `token: <tokenAutorizado>`, `documento: <nitVigilado>`) y hace **un solo POST** al endpoint de llegadas (`{URL_DESPACHOS}/llegadasempresas`).
3. **Given** un usuario rol 3, **When** su llegada se reporta, **Then** usa el `usn_token_autorizado` y el NIT **heredados del administrador** (misma regla que despachos).
4. **Given** un reporte externo exitoso, **When** el worker recibe la respuesta, **Then** persiste `id_llegada_externo` (extraído con candidatos `obj.obj.id | obj.id | obj.idLlegada | data.idLlegada | data.id | idLlegada | id`) y `respuesta_externa`, marca `procesado=true`, `estado='procesado'`.
5. **Given** un reporte externo fallido, **When** el worker recibe error, **Then** persiste `error_externo`, incrementa `reintentos`, reprograma `siguiente_intento` (+5 min) hasta el máximo y luego `estado='fallido'` — **sin quedar atascado**.
6. **Given** una llegada `fallido`, **When** el usuario pulsa "Reintentar", **Then** el endpoint re-encola con `reintentos=0`, `estado='pendiente'`, `siguiente_intento=now` (handler funcional).
7. **Given** modo stub, **When** se procesa cualquier llegada, **Then** **no sale ninguna petición** a la Super; el `ClienteStub` simula la respuesta y solo se loguean nombres de cabecera.

---

### User Story 2 - Dashboard y listado de llegadas (Priority: P2)

El vigilado ve en el dashboard un **KPI de llegadas de hoy** (zona America/Bogota) y un **listado paginado server-side** de sus llegadas con su estado de cola.

**Why this priority**: Da visibilidad operativa. Reutiliza el patrón de paginación y KPI del despacho; valor incremental sobre el core de US1.

**Independent Test**: Autenticado, `GET /api/integracion/llegadas?page=&pageSize=` devuelve la página del vigilado y el total; el KPI `llegadasHoy` cuenta solo las de hoy (Bogotá).

**Acceptance Scenarios**:

1. **Given** un vigilado con llegadas, **When** consulta el listado, **Then** recibe `items` + `pagination{page,pageSize,total,totalPages}` filtrado por su NIT efectivo (rol 1 admin ve todo).
2. **Given** el dashboard, **When** se consulta el KPI, **Then** `llegadasHoy` cuenta solo `fecha_creacion >= inicioDiaBogota()`.

---

### Edge Cases

- ¿Qué pasa si `id_despacho` referencia un despacho inexistente? Se acepta como referencia lógica (no FK en el legacy); no se valida contra despachos en P2, se documenta.
- ¿Y si falta `placa` o `tipo_llegada`? Se rechaza en la API (400) antes de encolar.
- Subusuario rol 3 sin administrador o admin sin token → error de configuración (400), no se reporta (misma regla que despachos).
- Concurrencia de workers → un solo procesamiento por solicitud (advisory lock; el worker de llegadas comparte proceso/loop con el de despachos o usa su propio lock — ver plan).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar una llegada con **un solo POST**, persistiéndola en `tbl_llegadas_solicitudes` (`lle_sol_payload`, `lle_sol_nit_vigilado`, `lle_sol_usuario_id`, `lle_sol_placa`, `lle_sol_tipo_llegada`, `lle_sol_id_despacho?`, `lle_sol_fuente='WEB'`, `lle_sol_procesado=false`).
- **FR-002**: El sistema DEBE **añadir de forma aditiva** a `tbl_llegadas_solicitudes` las columnas de cola inexistentes en el legacy: `lle_sol_estado` (varchar 30, default 'pendiente'), `lle_sol_reintentos` (int, default 0), `lle_sol_rol_id` (int, nullable), `lle_sol_siguiente_intento` (timestamptz, default now), + índice `(lle_sol_estado, lle_sol_siguiente_intento)`. **Nunca** `migrate reset`.
- **FR-003**: El sistema DEBE reportar la llegada con las **3 cabeceras** del doble token, reutilizando `ClienteSupertransporte` (stub/real) y `construirCabeceras` (herencia rol 3).
- **FR-004**: El worker DEBE procesar `tbl_llegadas_solicitudes` con el mismo patrón table-driven que despachos (lote, `siguiente_intento`, backoff 5 min, máx 3 reintentos, advisory lock de instancia única).
- **FR-005**: El worker DEBE hacer POST a `{URL_DESPACHOS}/llegadasempresas` y extraer el id con `extraerIdLlegadaExterno` (candidatos: `obj.obj.id | obj.id | obj.idLlegada | data.idLlegada | data.id | idLlegada | id`).
- **FR-006**: El sistema DEBE ofrecer **reintento manual** (`POST /api/llegadas/[id]/reintentar`) que resetea `reintentos=0` y re-encola.
- **FR-007**: El sistema DEBE exponer `GET /api/integracion/llegadas` paginado server-side, filtrado por NIT efectivo (rol 1 ve todo).
- **FR-008**: El dashboard DEBE incluir `llegadasHoy` contando solo `fecha_creacion >= inicioDiaBogota()`.
- **FR-009 (guardarraíl)**: Con `INTEGRACIONES_MODO=stub` (default) **no se consume ninguna API productiva**; el modo real exige el doble gate y credenciales; los tests corren contra stub.
- **FR-010**: La herencia rol 3 (token+NIT del administrador) DEBE aplicarse igual que en despachos.

### Key Entities

- **LlegadaSolicitud** (`tbl_llegadas_solicitudes`): elemento de la cola de reporte de llegadas. Columnas base verificadas + columnas de cola añadidas aditivamente (ver `data-model.md`). Referencia lógica opcional a un despacho (`lle_sol_id_despacho`, sin FK física).

---

## Success Criteria *(mandatory)*

- **SC-001**: El 100% de las llegadas reportadas salen con las **3 cabeceras** correctas; ninguna con menos de tres.
- **SC-002**: Una llegada que falla queda reintentable con contador correcto; el reintento manual funciona el 100% de las veces (sin atascos).
- **SC-003**: `GET /api/integracion/llegadas` responde paginado en < 1s con datos del vigilado correcto.
- **SC-004**: KPI `llegadasHoy` cuenta solo las de hoy (Bogotá).
- **SC-005**: Con modo stub, cero peticiones a `*.supertransporte.gov.co` (verificable).

---

## Assumptions

- Reutiliza el stack e infraestructura de la feature 001 (Next.js 16, Prisma `sicov`, worker table-driven, cliente doble token con stub).
- La migración de columnas de cola de llegadas es **aditiva** sobre la tabla existente (BD del 003).
- El worker de llegadas sigue el mismo patrón; su ejecución (loop compartido con despachos vs. proceso propio) se decide en `plan.md`.
- Payload exacto de `llegadasempresas` queda `[NEEDS CLARIFICATION]`; el stub respeta el contrato de cabeceras.

## Preguntas abiertas (para `/speckit.clarify`, no bloquean el stub)
- **[NEEDS CLARIFICATION]** Estructura exacta del payload de `llegadasempresas` y de su respuesta.
- **[NEEDS CLARIFICATION]** Catálogo de `tipo_llegada` (valores válidos).
- **[NEEDS CLARIFICATION]** ¿El worker de llegadas comparte proceso con el de despachos (un solo supervisor, dos loops) o es un proceso/lock separado?
