# Feature Specification: Wizard de salidas (registro de despacho)

**Feature Branch**: `[004-salidas-wizard]`

**Created**: 2026-07-21

**Status**: IMPLEMENTADO y probado en vivo (modo stub) — pendiente de verificación humana antes de APIs productivas — ver `cierre.md`

**Input**: User description: "Flujo estrella del sistema: el wizard de salidas. cabecera → consulta integradora (reusa 003) → subformularios conductores/vehículo/rutas/autorizaciones → UN solo POST de despacho (reusa el doble token de US2). Deriva UI y payload del legacy (salidas-continuar-registro-modal, salidas-payload.util, RegistroDespachoIntegracion). Reusa lo existente: no dupliques cliente/worker/integradora; compón. Guardarraíl: INTEGRACIONES_MODO=stub, cero APIs reales."

---

## Contexto de reuso (no duplicar)
Esta feature es **composición de UI + armado de payload**; reutiliza:
- **Consulta integradora** (feature 003): `POST /api/integracion/integradora/resumen`.
- **Reporte de despacho** (feature 001-US2): `POST /api/integracion/despachos` (encola; el worker table-driven reporta con doble token). **No** se toca cliente/worker.
- Añade: constructor de payload (`salidas-payload.util` portado) y **endpoints de maestras** (rutas, autorizaciones) que el wizard necesita.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un despacho con el wizard (Priority: P1)

Una empresa vigilada (o su operador rol 3) registra una salida: llena la **cabecera**, ejecuta la **consulta integradora** (que habilita y autocompleta el resto), completa los subformularios de **conductores**, **vehículo**, **rutas** y **autorizaciones**, y envía todo con **un solo POST**. El sistema encola el despacho (reporte con doble token vía el worker).

**Why this priority**: Es el flujo operativo central del sistema (salidas). Integra en un solo caso de uso la consulta integradora (003) y el reporte de despacho (US2).

**Independent Test**: En modo stub, un usuario autenticado completa cabecera + integradora + subformularios y envía; el sistema construye el `RegistroDespachoIntegracion` y lo encola (`POST /api/integracion/despachos` → 202); el worker lo procesa (procesado), sin llamar a APIs reales.

**Acceptance Scenarios**:

1. **Given** un vigilado autenticado, **When** abre el wizard, **Then** ve la sección **cabecera** habilitada y las demás secciones **bloqueadas** hasta ejecutar la consulta integradora.
2. **Given** la cabecera y datos de integradora (placa + numeroIdentificacion1 [+2] + fecha [+hora]), **When** ejecuta "Consultar integradora", **Then** el sistema llama a `POST /api/integracion/integradora/resumen`, guarda la respuesta y **habilita/autocompleta** conductores y vehículo.
3. **Given** la integradora respondió, **When** se muestran los subformularios, **Then** vehículo se autocompleta con pólizas/tarjeta/mantenimientos de la respuesta y conductores con la persona/licencia.
4. **Given** rutas, **When** el usuario carga rutas activas de la empresa, **Then** el sistema consulta `GET /api/integracion/maestras/rutas-activas-empresa?nit=` y arma `obj_rutas`.
5. **Given** autorizaciones (opcional), **When** el usuario las consulta, **Then** `GET /api/integracion/maestras/autorizaciones?nit=&placa=&fecha=` y se agregan a `array_autorizaciones`.
6. **Given** todos los subformularios válidos, **When** pulsa "Registrar despacho", **Then** el sistema construye `RegistroDespachoIntegracion` (obj_despacho/obj_vehiculo/obj_conductores/obj_rutas/array_autorizaciones?) y hace **UN solo POST** a `/api/integracion/despachos` → 202 con `solicitudId`.
7. **Given** un usuario rol 3, **When** registra, **Then** el despacho hereda token/NIT del administrador (regla de US2, sin cambios).
8. **Given** modo stub, **When** cualquier paso llama a la Super, **Then** **no sale ninguna petición real**; integradora y maestras devuelven datos simulados.
9. **Given** el botón "Registrar", **When** falta integradora, vehículo, conductores o ruta, **Then** está deshabilitado (no se puede enviar incompleto).

---

### User Story 2 - Listado de salidas (Priority: P2)

El vigilado ve el listado de sus despachos (con estado de cola) y puede abrir el wizard para registrar uno nuevo.

**Independent Test**: `GET /api/integracion/despachos` (ya existe, US2) devuelve el listado paginado; la pantalla lo muestra y ofrece "Registrar salida".

**Acceptance Scenarios**:
1. **Given** el vigilado, **When** abre salidas, **Then** ve el listado (reusa `GET /api/integracion/despachos`) con estado y botón "Reintentar" para fallidos (reusa endpoint US2).
2. **Given** el listado, **When** pulsa "Registrar salida", **Then** abre el wizard (US1).

---

### Edge Cases

- Placa inválida → validar formato (5–6, `[A-Z0-9]`, `limpiarPlaca`); bloquear consulta.
- `numeroIdentificacion1` fuera de 6–10 dígitos → inválido.
- `fechaSalida` > hoy (Bogota) o `horaSalida` > hora actual (Bogota) → rechazar (paridad legacy).
- `numeroPasajero` fuera de 1–85 → inválido (opcional).
- Integradora sin datos → el wizard permite carga manual mínima pero advierte.
- Segundo conductor: visible solo si la integradora indica `tieneConductorSecundario` o si se pasó `numeroIdentificacion2`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El wizard DEBE ser **una sola pantalla con secciones colapsables** gateadas por la consulta integradora (no un stepper), fiel al legacy.
- **FR-002**: La sección de integradora DEBE reutilizar `POST /api/integracion/integradora/resumen` (feature 003); su respuesta **autocompleta** vehículo y conductores.
- **FR-003**: El sistema DEBE proveer maestras para el wizard: `GET /api/integracion/maestras/rutas-activas-empresa` y `GET /api/integracion/maestras/autorizaciones` (read-through; **stub** por defecto).
- **FR-004**: El sistema DEBE construir el `RegistroDespachoIntegracion` con `buildObjDespacho/Vehiculo/Conductores/Rutas` (portado de `salidas-payload.util`), normalizando todos los campos a **string** (los numéricos a `String`), `limpiarPlaca`, y combinando form + respuesta de integradora.
- **FR-005**: El envío DEBE ser **UN solo POST** a `/api/integracion/despachos` (US2); **no** se crea un endpoint nuevo de reporte ni se duplica el worker.
- **FR-006**: El botón "Registrar" DEBE habilitarse solo si integradora + vehículo + conductores + ruta están completos.
- **FR-007**: Validaciones de negocio: placa (formato + `limpiarPlaca`), identificación (6–10 dígitos), `fechaSalida ≤ hoy`, `horaSalida ≤ hora actual` (America/Bogota).
- **FR-008 (guardarraíl)**: Con `INTEGRACIONES_MODO=stub` (default) **cero APIs reales**; integradora y maestras devuelven datos simulados. Modo real exige doble gate + credenciales.
- **FR-009**: El listado de salidas DEBE reutilizar `GET /api/integracion/despachos` y el reintento `POST /api/despachos/[id]/reintentar` (US2).
- **FR-010**: La herencia rol 3 y el doble token del reporte se heredan de US2 **sin cambios**.

### Key Entities (DTOs, ver data-model)

- **RegistroDespachoIntegracion**: `{ obj_despacho, obj_vehiculo, obj_conductores, obj_rutas, array_autorizaciones? }` (payload del POST de despacho).
- **RutaMaestra** / **AutorizacionMaestra**: opciones que alimentan `obj_rutas` y `array_autorizaciones`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un usuario completa el wizard y registra un despacho (202) en < 5 pasos, con **un solo POST**.
- **SC-002**: El payload enviado cumple la forma `RegistroDespachoIntegracion` (5 bloques), con todos los valores string.
- **SC-003**: Con modo stub, cero peticiones a `*.supertransporte.gov.co` en todo el flujo.
- **SC-004**: El wizard **no** duplica cliente/worker/integradora: reutiliza los endpoints existentes (verificable: sin nuevo cliente HTTP ni worker).
- **SC-005**: El despacho registrado por el wizard aparece en el listado y es procesado por el worker (modo stub).

---

## Assumptions

- Reutiliza features 001 (auth, despacho, worker), 003 (integradora). No hay tablas nuevas ni migración.
- Las maestras (rutas/autorizaciones) se implementan como read-through con stub; su auth real (TOKEN estático / paramétricas) se resuelve al conectar el modo real.
- La UI reproduce el flujo del legacy (secciones colapsables, no stepper); el estilo es propio (tailwind).

## Preguntas abiertas (para `/speckit.clarify`)
- **[NEEDS CLARIFICATION]** Contrato externo exacto de `rutas-activas-empresa` y `maestras/autorizaciones` (auth: TOKEN estático vs paramétricas; forma de respuesta).
- **[NEEDS CLARIFICATION]** Reglas exactas de autocompletado vehículo↔integradora (qué campos pisan al form) más allá de lo observado en `salidas-payload.util`.
- **[NEEDS CLARIFICATION]** Catálogos de `clase`, `nivelServicio`, `tipoIdentificacion`, `via` (paramétricas).
