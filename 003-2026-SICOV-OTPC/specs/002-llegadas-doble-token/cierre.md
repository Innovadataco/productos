# Cierre — 002-llegadas-doble-token

**Estado:** IMPLEMENTADO y probado en vivo (modo stub) — pendiente de **verificación humana antes de consumir las APIs productivas**.
**Fecha:** 2026-07-21 · Reusa el patrón de la feature 001-US2 (despacho).

## Qué se entregó
- **Datos:** modelo `LlegadaSolicitud` (14 columnas base verificadas vs legacy + 4 de cola añadidas **aditivamente**); migración `add_llegadas_cola` (nueva tabla, sin DROP); seed con llegadas demo.
- **Lib:** `extraerIdLlegadaExterno` (candidatos verificados) en `normalizar.ts`; `src/lib/llegadas/cola.ts` (`enviarLlegada`, `procesarLoteLlegadas`, `reintentarLlegada`) reusando el cliente doble token, `construirCabeceras` y la herencia rol 3.
- **US1:** `POST /api/integracion/llegadas` (encola; valida placa/tipoLlegada y la regla tipo1↔idDespacho); worker **único con dos pasadas** (despachos + llegadas) bajo **un solo advisory lock** (`scripts/worker.mjs`, renombrado desde `worker-despachos.mjs`); `POST /api/llegadas/[id]/reintentar`.
- **US2:** `GET /api/integracion/llegadas` (listado paginado server-side); KPI `llegadasHoy`/`llegadasEnCola` en `GET /api/dashboard`.

## Guardarraíl cumplido
🔒 `INTEGRACIONES_MODO=stub` por defecto; **cero llamadas a las APIs productivas**. El worker arma las 3 cabeceras hacia `/llegadasempresas` pero el `ClienteStub` no hace `fetch`. `ClienteHttp` real sigue bloqueado por doble gate + credenciales.

## Verificación (5 reglas de oro)
| Gate | Resultado |
|---|---|
| `tsc --noEmit` | ✅ 0 errores |
| `vitest run` | ✅ **45/45** (+10 nuevos: cola llegadas, extraerIdLlegadaExterno) |
| `eslint .` | ✅ 0 errores |
| `next build` | ✅ 14 rutas (incluye `/api/integracion/llegadas`, `/api/llegadas/[id]/reintentar`) |
| Smoke en vivo (stub) | ✅ ver abajo |

### Smoke en vivo (modo stub, BD 003 :5434)
- Llegada tipo 2 (sin despacho) → `procesado`; tipo 1 (idDespacho=4) → `procesado`.
- Validación: tipo 2 con idDespacho → **400**.
- Llegada **rol 3 operador** → `nit=900853057` **heredado del administrador** → `procesado`.
- Worker procesó en su **segunda pasada** (llegadas) bajo el mismo lock.
- Listado paginado (total 5, 2 páginas); KPI `llegadasHoy=5`; reintento resetea `reintentos=0`; sin sesión → 401.
- **Operación:** dev/worker detenidos matando **solo por PID/puerto del 003 (5010)**; 001/002 intactos (regla AGENTS.md §6).

## Deuda técnica / pendiente
- **VERIFICACIÓN HUMANA antes de APIs reales** (TX01): activar `ClienteHttp` para llegadas requiere aprobación + credenciales rotadas.
- `[NEEDS CLARIFICATION]`: payload exacto de `llegadasempresas` y catálogo completo de `tipoLlegada` (en código solo se observan 1 y 2).
- El worker persiste su comportamiento síncrono del legacy como cola diferida (nuestro 003 encola siempre y deja el envío al worker; el legacy además intentaba envío inmediato).
- UI de llegadas: no incluida (P2 opcional); el flujo se ejercita por API.
