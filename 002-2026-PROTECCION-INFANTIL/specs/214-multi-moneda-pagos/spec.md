# SPEC-214 · Multi-moneda + API tasas (002-PI-114)

> Status: `IMPLEMENTADO`
> PI: 002-PI-114
> Responsable: ODIN
> Rama: `work/002-PI-pagos-lote2`
> Base: `feature/001-scaffolding`

## Contexto

Soporte multi-moneda para el Módulo Pagos. El CEO fija precios en USD y el sistema los convierte a moneda local del cliente usando tasas de cambio públicas. Incluye integración con API externa (exchangerate.host o equivalente sin API key), fallback manual por admin, histórico append-only en `TasaCambio` (modelo de SPEC-210), y refresco automático cada 24h.

Depende de SPEC-210. No implementa pasarela ni cobro automático; solo obtiene, almacena y expone tasas para que otros flujos (renovación, autorización) calculen montos locales.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como sistema, quiero consultar tasas de cambio desde una API pública, para mostrar precios en moneda local del cliente. | Must |
| US-002 | Como ADMIN, quiero inyectar manualmente una tasa cuando la API falle, para no bloquear pagos. | Must |
| US-003 | Como sistema, quiero refrescar tasas automáticamente cada 24h, para mantener los precios actualizados sin intervención. | Must |
| US-004 | Como sistema, quiero guardar histórico de tasas append-only, para auditar qué tasa se aplicó a cada pago. | Must |
| US-005 | Como ADMIN, quiero ver un banner cuando la tasa de una moneda tenga más de 48h sin actualización, para saber que debo actuar. | Should |

## Acceptance Scenarios

### AS-001 · Refresco automático inicial
**Given** un catálogo de monedas configurado (COP, MXN, CLP, ARS)  
**When** el worker de tasas corre por primera vez  
**Then** crea filas en `TasaCambio` con `fuente=API` para cada moneda del catálogo.

### AS-002 · API caída
**Given** la API externa no responde  
**When** el worker intenta refrescar  
**Then** no borra filas previas, registra fallo en logs, y la UI muestra banner "tasa desactualizada" si la última tasa tiene >48h.

### AS-003 · Inyección manual
**Given** un admin en `/admin/pagos/tasas`  
**When** ingresa tasa manual para COP  
**Then** persiste en `TasaCambio` con `fuente=ADMIN_MANUAL`, `ingresadoPorAdminId`, `motivoManual` y registra `AuditLog`.

### AS-004 · Cálculo de precio
**Given** un plan con `precioBaseUSD = 100` y tasa COP vigente = 4000  
**When** se muestra precio al cliente  
**Then** el monto local es 400,000 COP usando la tasa más reciente.

### AS-005 · Congelamiento en pago
**Given** un pago autorizado con `tasaCambioAplicada = 4100`  
**When** la tasa cambia a 4200 al día siguiente  
**Then** el pago conserva 4100; no se recalcula retroactivamente.

### AS-006 · Refresco programado
**Given** parámetro `pagos.tasas.refresco_horas = 24` y `pagos.tasas.hora_refresco = 04:00`  
**When** llega la hora programada en Bogotá  
**Then** el worker consulta API y guarda nuevas tasas.

## Functional Requirements

- **FR-001**: El sistema DEBE consultar API pública de tasas (default `https://api.exchangerate.host/latest?base=USD`) con timeout 5s y 1 reintento.
- **FR-002**: El catálogo de monedas destino DEBE ser configurable por admin vía `ParametroSistema` (ej. `pagos.tasas.monedas_destino` como CSV: `COP,MXN,CLP,ARS`).
- **FR-003**: El worker DEBE refrescar tasas cada `pagos.tasas.refresco_horas` (default 24) a la hora `pagos.tasas.hora_refresco` (default 04:00) timezone `America/Bogota`.
- **FR-004**: El histórico `TasaCambio` DEBE ser append-only: nunca `DELETE`.
- **FR-005**: El endpoint `POST /api/admin/pagos/tasas` DEBE permitir inyectar tasa manual con validación Zod y registrar `AuditLog`.
- **FR-006**: El servicio de tasas DEBE exponer función `obtenerTasaVigente(monedaDestino)` que retorne la tasa más reciente o null si no existe.
- **FR-007**: El sistema DEBE marcar una tasa como desactualizada si su `fecha` > 48h respecto a ahora Bogotá.
- **FR-008**: El cálculo de monto local DEBE usar `precioNetoUSD × tasaVigente` y congelar el resultado en `Pago.tasaCambioAplicada`/`montoLocalPagado`.
- **FR-009**: Todo acceso a datos DEBE pasar por `pagos-repository` (DAL).
- **FR-010**: No se DEBE tocar `src/lib/ai/**`.

## Non-Functional Requirements

- **NFR-001**: Gate local completo por SPEC.
- **NFR-002**: Tests de integración para worker/API y endpoint manual.
- **NFR-003**: `arch:check` verde; DAL no expone Prisma a endpoints.
- **NFR-004**: Llamadas a API externa en tests deben estar mockeadas o usar respuesta controlada.

## Success Criteria

- **SC-001**: Worker crea filas `TasaCambio` con `fuente=API` para cada moneda del catálogo.
- **SC-002**: API caída no borra histórico y activa banner de desactualización si >48h.
- **SC-003**: Endpoint admin inyecta tasa manual + `AuditLog`.
- **SC-004**: Servicio expone tasa vigente y calcula monto local correctamente.
- **SC-005**: Gate local completo verde.
- **SC-006**: CI 6/6 verde en el PR a `feature/001-scaffolding`.

## Assumptions

- SPEC-210 entregó modelo `TasaCambio` y parámetros `pagos.tasas.*`.
- La API externa no requiere API key y permite consulta base USD.
- SPEC-211/212 consumirán el servicio de tasas; SPEC-214 solo lo provee.
- El worker puede reutilizar el scheduler de `pi-vigencia` (SPEC-213) o ser un servicio/cron independiente; se decide en plan.

## Decisiones propuestas para compuerta §4

1. **API primaria**: usar `api.exchangerate.host` (sin key) con timeout 5s y 1 reintento; permitir override por `pagos.tasas.api_url_default`.
2. **Worker**: crear un job/service separado `actualizarTasasCambio` invocable vía `npm run worker:tasas` y también encolable desde un cron; no bloquear el worker principal de reportes.
3. **Catálogo de monedas**: paramétrico vía `pagos.tasas.monedas_destino` (CSV), seed default `COP,MXN,CLP,ARS`.
4. **DAL único**: todo acceso a `TasaCambio` pasa por `pagos-repository`.
5. **Desactualización**: banner cuando `now - tasa.fecha > 48h`; no bloquear operaciones.

## Implementación

Entregado en rama `work/002-PI-pagos-lote2` sobre base `244e9d7c`:

- `src/lib/pagos/tasas.ts`: `calcularMontoLocal`, `actualizarTasasDesdeAPI` con timeout 5s, 1 reintento, parseo robusto de `rates`/`conversion_rates`, catálogo configurable por `ParametroSistema`.
- `scripts/worker-tasas.mjs`: worker con advisory lock de PostgreSQL y scheduler de refresco diario a las 04:00 America/Bogota.
- `src/app/api/admin/pagos/tasas/route.ts`: `GET` listado vigente y `POST` inyección manual con `AuditLog`.
- `src/lib/dal/repositories/pagos-repository.ts`: `crearTasaCambio`, `obtenerTasaCambioMasReciente`, `listarTasasVigentes`.
- Tests unitarios con `fetch` mockeado y tests de integración para el endpoint.

## Impacto en arquitectura:

Impacto en arquitectura: nuevo servicio `src/lib/pagos/tasas.ts`, script/worker `scripts/worker-tasas.mjs`, endpoint `src/app/api/admin/pagos/tasas/route.ts`, extensión de `pagos-repository.ts`. No cambia modelos de datos salvo posible parámetro adicional. No toca IA ni flujo de reportes.

## Deuda Técnica

- API externa puede cambiar de dominio/límites; el parámetro `pagos.tasas.api_url_default` permite migrar sin deploy.
- Worker de tasas es independiente; en el futuro podría unificarse con scheduler genérico de tareas.
