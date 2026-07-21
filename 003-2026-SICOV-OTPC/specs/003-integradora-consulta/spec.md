# Feature Specification: Consulta integradora (verificación en vivo SICOV)

**Feature Branch**: `[003-integradora-consulta]`

**Created**: 2026-07-21

**Status**: IMPLEMENTADO y probado en vivo (modo stub) — pendiente de verificación humana antes de APIs productivas — ver `cierre.md`

**Input**: User description: "Consulta integradora del SICOV: verifica EN VIVO licencia, SOAT, RTM, alcoholimetría, pólizas y tarjeta de operación de conductor(es)+vehículo. Es una consulta de solo lectura, síncrona (no transaccional, sin cola/worker). Se llama server-side con las 3 cabeceras (doble token, reusando construirCabeceras), como el backend legacy. Endpoint POST resumen + pantalla de consulta (placa + identificación + fecha). Guardarraíl: INTEGRACIONES_MODO=stub, cero APIs reales. Contrato externo exacto = [NEEDS CLARIFICATION] si no se verifica."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar en vivo la habilitación de conductor+vehículo (Priority: P1)

Un usuario autenticado (vigilado o su operador) consulta, antes de despachar, el estado de habilitación de un vehículo y su(s) conductor(es): licencia, SOAT, RTM, alcoholimetría, examen médico, pólizas y tarjeta de operación. Ingresa placa + número(s) de identificación + fecha (y hora si la fecha no es hoy) y el sistema devuelve el **resumen integrador** consultado en vivo contra el SICOV.

**Why this priority**: La consulta integradora es el chequeo previo que habilita (o no) una salida y aparece en el dashboard, el wizard de despachos y novedades. Es el tercer punto de integración con la Super y el único de **solo lectura**.

**Independent Test**: Autenticado y en modo stub, se envía `{placa, numeroIdentificacion1, fechaConsulta}` al endpoint de resumen y se recibe una estructura con conductor(es) y vehículo verificados (licencia/SOAT/RTM/alcoholimetría/pólizas/tarjeta), sin persistir nada y sin llamar a la API real.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** consulta con `placa` + `numeroIdentificacion1` + `fechaConsulta` válidos, **Then** el sistema devuelve `RespuestaIntegradora` (conductor1, vehiculo, polizas, tarjetaOperacion, mantenimientos, empresa) con estados y fechas de vencimiento.
2. **Given** una consulta con `numeroIdentificacion2`, **When** hay segundo conductor, **Then** el resumen incluye `conductor2`.
3. **Given** la consulta, **When** el sistema (server-side) llama a la integradora, **Then** arma las **3 cabeceras** (`Authorization: Bearer <tokenExterno>`, `token: <tokenAutorizado>`, `documento: <nitVigilado>`) reutilizando `construirCabeceras`, igual que el backend legacy.
4. **Given** una `fechaConsulta` distinta de hoy, **When** se consulta, **Then** se exige/usa `horaConsulta` (paridad con el legacy).
5. **Given** modo stub, **When** se consulta, **Then** **no sale ninguna petición** a la API real; el `ClienteStub` devuelve un resumen simulado (documentos vigentes) y no persiste nada.
6. **Given** una placa/identificación sin datos en la integradora, **When** se consulta, **Then** el sistema responde de forma controlada (404/estructura vacía normalizada), sin romper.
7. **Given** un `tokenExterno` vencido, **When** se consulta, **Then** el `TokenProveedorStore` lo refresca (en real) o entrega uno stub (en stub) antes de consultar.

---

### Edge Cases

- Placa mal formada → normalizar con `limpiarPlaca` (sin espacios/guiones, mayúsculas); rechazar (400) si queda vacía.
- `numeroIdentificacion1` ausente → 400.
- Respuesta externa con forma variable → normalizar tolerando `parsed.obj ?? parsed` (paridad `salidas-integradora.util`).
- Timeout de la integradora (legacy: 100 s) → responder 504/502 controlado; no colgar la request.
- La consulta **no** debe usarse como veredicto persistente: es informativa/en vivo (constitución §0).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `POST /api/integracion/integradora/resumen` que recibe `{ placa, numeroIdentificacion1, numeroIdentificacion2?, nit?, fechaConsulta, horaConsulta? }` y devuelve `RespuestaIntegradora`.
- **FR-002**: La consulta DEBE ser **síncrona y de solo lectura**: sin cola, sin worker, sin persistir en BD (no crea tablas).
- **FR-003**: La consulta se hace **server-side** y DEBE usar las **3 cabeceras** del doble token (`Authorization: Bearer <tokenExterno>` + `token: <tokenAutorizado>` + `documento: <nitVigilado>`), **reutilizando `construirCabeceras`** (misma herencia rol 3), igual que el backend legacy (`ClienteApiSupertransporte.postTransaccional`). *(Corrección de diseño del responsable. El frontend legacy llamaba la integradora con solo Bearer, pero aquí la llamada es server-side y replica el backend.)*
- **FR-004**: El sistema DEBE normalizar la respuesta externa tolerando `parsed.obj ?? parsed` y claves snake/camel.
- **FR-005**: El sistema DEBE `limpiarPlaca` la placa y validar `numeroIdentificacion1` (400 si falta).
- **FR-006**: Si `fechaConsulta` ≠ hoy (America/Bogota), el sistema DEBE requerir/usar `horaConsulta`.
- **FR-007 (guardarraíl)**: Con `INTEGRACIONES_MODO=stub` (default) la consulta **no consume la API productiva**; el `ClienteStub` devuelve un resumen simulado. El modo real exige el doble gate + credenciales.
- **FR-008**: El endpoint DEBE aplicar `verifyAuth([1,2,3])`.
- **FR-009**: El sistema DEBE ofrecer una **pantalla de consulta** (placa + identificación + fecha) que muestre el resumen (conductor(es) + vehículo con estados/vencimientos).
- **FR-010**: Ante timeout/upstream error, el sistema DEBE responder con estado controlado (502/504), sin exponer stack traces.

### Key Entities (DTOs, no tablas)

- **SolicitudIntegradora** (request): `placa`, `numeroIdentificacion1`, `numeroIdentificacion2?`, `nit?`, `fechaConsulta`, `horaConsulta?`.
- **RespuestaIntegradora** (response): `conductor1`, `conductor2`, `vehiculo`, `polizas{contractual,extracontractual}`, `tarjetaOperacion`, `mantenimientoPreventivo/Correctivo`, `alistamientoDiario`, `autorizaciones[]`, `empresa`. Cada `Conductor` = `{persona, licencia, alcoholimetria, examenMedico, aptitudFisica}`; `Vehiculo` = `{placa, claseVehiculo(+codigo), numeroSoat, soatVencimiento, numeroRtm, rtmVencimiento}`. (Ver `data-model.md`.)

---

## Success Criteria *(mandatory)*

- **SC-001**: Una consulta válida devuelve el resumen en < 3 s (modo stub, instantáneo).
- **SC-002**: El 100% de las consultas salen con las **3 cabeceras** (server-side, vía `construirCabeceras`).
- **SC-003**: Con modo stub, cero peticiones a `*.supertransporte.gov.co`.
- **SC-004**: La consulta no persiste registros (sin escritura en BD).
- **SC-005**: La pantalla muestra estado y vencimiento de licencia, SOAT, RTM, alcoholimetría, pólizas y tarjeta de operación.

---

## Assumptions

- Reutiliza infraestructura de features 001/002 (Next.js, `TokenProveedorStore`, cliente stub/real, gate).
- No se persiste el resultado (consulta en vivo); posible caché/auditoría queda como deuda futura.
- El `nit` puede derivarse del contexto de sesión si no se envía (NIT efectivo, herencia rol 3).

## Preguntas abiertas (para `/speckit.clarify`)
- **[NEEDS CLARIFICATION]** Estructura/nombres EXACTOS del payload de request de `api-integradora/resumen` (el modelo del front define la respuesta; el request se infiere de la pantalla: placa+identificación+fecha+hora+nit).
- **[NEEDS CLARIFICATION]** Forma exacta del envoltorio de respuesta real (`obj` vs raíz) y códigos de "no encontrado".
- **[NEEDS CLARIFICATION]** ¿La Super exige las **3 cabeceras** o solo Bearer en `/api-integradora/resumen`? — el 003 usa **3 cabeceras server-side** (decisión del responsable, replica el backend legacy); **verificar en modo real**.
