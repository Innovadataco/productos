# Feature Specification: 013 — Consola de APIs de la Super (Fase 1: UI + estructura + logging, SOLO stub)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-23

**Status**: ✅ IMPLEMENTADO (2026-07-23, radicado 003-SICOV-007; auditoría ZEUS aprobada). Ver [cierre.md](./cierre.md).

**Input**: Encargo 003-SICOV-004 (ZEUS). Submódulo APIs del módulo Configuración (solo rol 1).
**FASE 1 (D-047): NO se ejecuta contra producción** — las respuestas salen del STUB actual; el
flujo "ejecutar en real" queda VISIBLE pero DESHABILITADO ("Fase 2"). El logging de llamadas SÍ se
construye ya, sobre el stub. Regla CEO (AGENTS §6): pasar a real es decisión EXPLÍCITA del CEO.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Catálogo y formularios por operación, ejecutando SOLO contra el stub (Priority: P1)

El rol 1 entra a Configuración → APIs y ve el **catálogo de las APIs de la Super por operación**
(despachos, llegadas, mantenimiento base/preventivo/correctivo, consulta integradora, maestras
rutas/autorizaciones; alistamientos/autorizaciones/novedades listadas como "pendiente spec
006/007/008"). Cada entrada muestra método, endpoint externo, cabeceras que aplican (solo NOMBRES,
jamás valores) y un **formulario** con los campos del payload. "Ejecutar (stub)" corre la llamada
por el **cliente stub actual** y muestra la respuesta simulada. El botón **"Ejecutar en real"
está visible pero DESHABILITADO** con la nota "Fase 2 — requiere habilitación del CEO".

**Acceptance Scenarios**:

1. **Given** rol 1 en la consola, **When** abre una operación, **Then** ve método+endpoint+
   cabeceras aplicables (nombres) y el formulario prellenado con un ejemplo válido editable.
2. **Given** un formulario diligenciado, **When** pulsa "Ejecutar (stub)", **Then** la llamada va
   por `getClienteSupertransporte()` (stub por el doble gate apagado), se muestra
   request/respuesta/duración, y **cero peticiones salen a `*.supertransporte.gov.co`**.
3. **Given** cualquier operación, **When** observa el botón "Ejecutar en real", **Then** está
   deshabilitado con la nota "Fase 2" — **no existe código de ejecución real detrás** del botón.
4. **Given** roles 2/3, **When** intentan la consola (UI o API), **Then** 403 (rol 1 + guard
   `configuracion`/`apis`).

---

### User Story 2 - Logging de llamadas (Priority: P1 — se construye YA, sobre el stub)

Toda ejecución desde la consola queda registrada: **operación, request (payload), response,
status, modo (stub|real), duración, timestamp y usuario**. La bitácora es consultable y paginada
desde la propia consola. En Fase 2 el MISMO logging registrará las llamadas reales sin cambios.

**Acceptance Scenarios**:

1. **Given** una ejecución stub, **When** termina (éxito o error), **Then** queda una fila con
   usuario, operación, modo `stub`, payload enviado, respuesta/error, duración y timestamp
   (Bogotá). **Nunca** se persisten valores de tokens/cabeceras — solo sus nombres.
2. **Given** la bitácora, **When** rol 1 la consulta, **Then** listado paginado server-side con
   filtros (operación, modo, status, fecha) y detalle por fila.
3. **Given** un payload con campos sensibles conocidos (`clave`, `token`...), **When** se registra,
   **Then** esos campos se redactan (`"***"`) antes de persistir.

### Edge Cases

- Payload JSON inválido en el formulario → 400 con el error de parseo, sin registrar basura (se
  registra el intento con status 400 y el texto crudo truncado).
- Stub que lanza (placa FAL*) → la fila queda con status de error y el mensaje — sirve para
  demostrar el ciclo completo de bitácora.
- Respuestas grandes → truncado documentado (límite por columna) sin romper la fila.
- Cualquier intento de POST al endpoint "real" (aunque el botón está deshabilitado, la API
  server-side también lo rechaza) → 403 "Fase 2 — deshabilitado" y fila en bitácora.

## Requirements *(mandatory)*

- **FR-001**: Catálogo de operaciones como CONSTANTE de código (no BD) con: clave, título, método,
  path externo, cabeceras aplicables (nombres), payload de ejemplo y **cómo se ejecutará en Fase 2**
  (referencia al método del cliente: `postTransaccional` | `postMantenimiento` |
  `consultarIntegradora` | `getMantenimiento` | maestras) — la consola queda lista para Fase 2
  cambiando SOLO el gate, no su estructura.
- **FR-002**: `POST /api/configuracion/apis/ejecutar` (rol 1 + guard): valida operación del
  catálogo, ejecuta vía `getClienteSupertransporte()` (stub por gate apagado), registra y devuelve
  {respuesta, duración, logId}. **No existe rama de código que fuerce modo real.**
- **FR-003**: El "ejecutar en real" server-side responde 403 fijo en Fase 1 (flag de fase en
  código, no en env — que no sea activable por configuración accidental).
- **FR-004**: Bitácora **ADITIVA** `tbl_api_llamadas` (tabla NUEVA propia del 003): usuario, rol,
  NIT efectivo, operación, modo, request/response (Json redactado/truncado), status, duración ms,
  creado (timestamptz). Índices por (creado), (operacion), (modo).
- **FR-005**: `GET /api/configuracion/apis/llamadas` paginado server-side con filtros; solo rol 1.
- **FR-006**: Redacción de sensibles antes de persistir (lista de claves + nombres de cabecera
  solamente); nunca tokens en BD/logs.
- **FR-007**: UI en `/dashboard/configuracion/apis` (hereda breadcrumb del layout — I-14): lista
  de operaciones, formulario, resultado, bitácora; botón real deshabilitado con nota "Fase 2".
- **FR-008**: Tests de catálogo, ejecutar-stub (cero red), redacción, 403 de real y bitácora;
  suite previa verde.

### Key Entities

- **ApiLlamada** (`tbl_api_llamadas`, NUEVA aditiva): bitácora de la consola (campos FR-004).
- Catálogo de operaciones: constante tipada en `src/lib/consola-apis/catalogo.ts`.

## Success Criteria

- **SC-1**: Rol 1 ejecuta cualquier operación del catálogo contra el stub y ve respuesta+registro
  en bitácora; **cero tráfico** a la Super (verificable en tests).
- **SC-2**: El botón/endpoint real está bloqueado (UI deshabilitada + 403 server-side) — no hay
  camino de código a producción en Fase 1.
- **SC-3**: La bitácora persiste 100% de las ejecuciones (éxito y error) sin ningún token/clave.
- **SC-4**: Paso a Fase 2 = habilitar el gate + retirar el flag de fase, sin reestructurar consola
  ni logging (criterio de revisión del plan).

## Fuera de alcance (Fase 2 / otras specs)

Cliente real de la consola y su habilitación (decisión CEO); operaciones de 006/007/008 (solo
aparecen listadas como pendientes); reintentos/colas desde la consola (las colas ya tienen su
flujo); exportación de la bitácora.

## Assumptions

- La consola es herramienta de administración/diagnóstico del rol 1 (no de operación diaria).
- El catálogo Fase 1 cubre las operaciones YA integradas vía stub (7: despachos, llegadas,
  mantenimiento base/preventivo/correctivo, integradora, maestras×2).
- Retención de bitácora: sin purga automática en Fase 1 (deuda anotada).

## Implementación (003-SICOV-007)

**Estado**: ✅ IMPLEMENTADO. Detalle en [cierre.md](./cierre.md); pasos en [quickstart.md](./quickstart.md).

- **Lib**: `src/lib/consola-apis/{catalogo,ejecutar,redactar,bitacora}.ts` — único camino stub por
  gate, `FASE_CONSOLA=1`, redacción RECURSIVA + truncado, registro siempre. Modelo `ApiLlamada`
  (jsonb) en [data-model.md](./data-model.md).
- **Endpoints**: `src/app/api/configuracion/apis/{catalogo,ejecutar,llamadas}` (rol 1 + guard;
  `real:true` → 403). **UI**: `/dashboard/configuracion/apis` (botón real deshabilitado).
- **Verificación**: tests de consola verdes en 175/175 (incl. anti-red y redacción anidada); endpoint
  real 403 confirmado. Reinicio limpio compartido: `npm run reiniciar`.
- **Deuda**: purga/exportación de bitácora; `route.test.ts` no creado (tests de servicio).
