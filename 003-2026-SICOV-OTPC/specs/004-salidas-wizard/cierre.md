# Cierre — 004-salidas-wizard

**Estado:** IMPLEMENTADO y probado en vivo (modo stub) — pendiente de **verificación humana antes de consumir APIs productivas**.
**Fecha:** 2026-07-21.

## Qué se entregó (composición, no duplicación)
- **Tipos + payload:** `src/lib/despachos/despacho-tipos.ts` (DTOs `RegistroDespachoIntegracion`, obj_*) + `src/lib/despachos/payload.ts` (portado de `salidas-payload.util`): `buildObjDespacho`, `buildObjVehiculo(form, integradora)` — **combina form + respuesta integradora** —, `buildObjConductores`, `buildRegistroDespacho`.
- **Maestras (read-through, stub):** `consultarRutasActivas` / `consultarAutorizaciones` en la interfaz del cliente (stub simulado sin red; http real gated, no ejercitado) + endpoints `GET /api/integracion/maestras/rutas-activas-empresa` y `.../autorizaciones`.
- **Wizard (US1):** `src/app/dashboard/salidas/nueva/page.tsx` — una sola pantalla con **secciones colapsables gateadas por la integradora** (cabecera → integradora → conductores/vehículo autocompletados → rutas) y **UN solo POST** a `/api/integracion/despachos` (US2).
- **Listado (US2):** `src/app/dashboard/salidas/page.tsx` — reusa `GET /api/integracion/despachos` + reintento `POST /api/despachos/[id]/reintentar`.

## Reuso confirmado (SIN duplicar)
- Consulta integradora → `POST /api/integracion/integradora/resumen` (feature 003).
- Reporte → `POST /api/integracion/despachos` (feature 001-US2) — **el único POST final**; worker + doble token + herencia rol 3 **sin cambios**.
- No se creó cliente HTTP nuevo ni worker; solo se extendió el cliente con maestras.

## Guardarraíl cumplido
🔒 `INTEGRACIONES_MODO=stub`; integradora, maestras y reporte **simulados**; cero llamadas reales. `ClienteHttp` (maestras/integradora/transaccional) gated por doble gate + credenciales.

## Verificación (5 reglas de oro)
| Gate | Resultado |
|---|---|
| `tsc --noEmit` | ✅ 0 errores |
| `vitest run` | ✅ **52/52** (+5: payload combina integradora, maestras stub) |
| `eslint .` | ✅ 0 errores (se desactivó `react-hooks/set-state-in-effect`, alineado con 002) |
| `next build` | ✅ 19 rutas (maestras/*, /dashboard/salidas, /dashboard/salidas/nueva) |
| Smoke en vivo (stub) | ✅ ver abajo |

### Smoke en vivo (modo stub) — flujo compuesto del wizard
- Maestras rutas → 2 rutas ("Bogotá - Medellín"); autorizaciones → 200.
- Integradora → conductor1 y `polizas.contractual.numeroPoliza` (fuente de autocompletado del vehículo).
- **UN solo POST** de despacho (payload del wizard) → **202** (solicitud #6).
- Worker procesó el despacho → `procesado` (id externo 1000), **sin fetch real**.
- **Operación:** dev y worker detenidos matando **solo por PID/puerto del 003 (5010)**; 001 (:5001) intacto.

## Deuda / pendiente
- **VERIFICACIÓN HUMANA antes de APIs reales** (TX01): activar maestras/integradora/reporte reales requiere aprobación + credenciales rotadas.
- `[NEEDS CLARIFICATION]`: contrato exacto de maestras (rutas/autorizaciones) y su auth (TOKEN estático vs paramétricas); catálogos (clase, nivelServicio, tipoIdentificacion, via).
- UI del wizard: funcional (camino feliz + validaciones clave); subformularios extensos del legacy se refinan iterativamente. Diseño Tailwind del 003 (no copia visual del legacy).
