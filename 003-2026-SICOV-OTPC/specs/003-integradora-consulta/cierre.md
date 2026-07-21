# Cierre — 003-integradora-consulta

**Estado:** IMPLEMENTADO y probado en vivo (modo stub) — pendiente de **verificación humana antes de consumir la API productiva**.
**Fecha:** 2026-07-21.

## Qué se entregó
- **Tipos:** `src/lib/integracion/integradora-tipos.ts` (`SolicitudIntegradora`, `RespuestaIntegradora` y sub-DTOs, del modelo real del frontend).
- **Cliente:** `consultarIntegradora(body, identificacion, idRol)` añadido a la interfaz `ClienteSupertransporte`:
  - `ClienteStub`: arma las **3 cabeceras** (`construirCabeceras`, valida herencia rol 3) sin tocar red; devuelve resumen simulado (documentos VIGENTES).
  - `ClienteHttp`: `construirCabeceras` (3 cabeceras) + `POST {URL_INTEGRADORA}/api-integradora/resumen`, timeout 100 s, normaliza `obj ?? raíz`. Solo instanciable en modo real; **no ejercitado**.
- **Endpoint:** `POST /api/integracion/integradora/resumen` (síncrono; valida placa/identificación/fecha-hora; NIT efectivo; 502/504 controlados).
- **Pantalla:** `/dashboard/integradora` (formulario placa+identificación+fecha; render de conductor(es)+vehículo con estados/vencimientos; nota "consulta informativa en vivo") + enlace desde el dashboard.

## Corrección de diseño aplicada
La consulta se hace **server-side con las 3 cabeceras** del doble token (reusando `construirCabeceras`), como el backend legacy (`postTransaccional`) — NO solo Bearer. Ajustados spec (FR-003), contracts y plan. Si la Super exige solo Bearer en `/resumen` → `[NEEDS CLARIFICATION]` a validar en modo real.

## Guardarraíl cumplido
🔒 `INTEGRACIONES_MODO=stub` por defecto; **cero llamadas a la API productiva**. El stub arma las 3 cabeceras (verificable en log) pero no hace `fetch`. `ClienteHttp` bloqueado por doble gate + credenciales.

## Verificación (5 reglas de oro)
| Gate | Resultado |
|---|---|
| `tsc --noEmit` | ✅ 0 errores |
| `vitest run` | ✅ **47/47** (+2: consultarIntegradora stub) |
| `eslint .` | ✅ 0 errores |
| `next build` | ✅ 15 rutas (incl. `/api/integracion/integradora/resumen`, `/dashboard/integradora`) |
| Smoke en vivo (stub) | ✅ ver abajo |

### Smoke en vivo (modo stub, síncrono, sin worker)
- Consulta placa+ident1+fecha → `RespuestaIntegradora` (conductor1 VIGENTE, vehículo SOAT/RTM).
- `numeroIdentificacion2` → `conductor2` presente.
- Validaciones: sin placa → **400**; fecha≠hoy sin hora → **400**; sin sesión → **401**.
- **Guardarraíl:** log del stub `headers=[Authorization,token,documento,Content-Type]` (3 cabeceras), sin fetch real.
- **Operación:** dev detenido matando **solo por puerto 5010 del 003**; 001 (:5001) intacto.

## Deuda / pendiente
- **VERIFICACIÓN HUMANA antes de la API real** (TX01): activar `ClienteHttp.consultarIntegradora` requiere aprobación + credenciales rotadas, y validar si la Super exige 3 cabeceras o solo Bearer en ese endpoint.
- `[NEEDS CLARIFICATION]`: payload exacto de request y envoltorio de respuesta reales.
- Sin caché: cada consulta es en vivo (posible caché corta como mejora futura).
