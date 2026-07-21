# Contrato — Wizard de salidas (composición)

> Esta feature es **composición**: reutiliza endpoints existentes y añade solo maestras + el armado de payload. **Guardarraíl:** stub por defecto; modo real bloqueado hasta verificación humana.

## Endpoints reutilizados (SIN cambios)
| Endpoint | Feature | Uso en el wizard |
|---|---|---|
| `POST /api/integracion/integradora/resumen` | 003 | paso "consulta integradora" (autocompleta vehículo/conductores) |
| `POST /api/integracion/despachos` | 001-US2 | **el único POST final** (encola; el worker reporta con doble token) |
| `GET /api/integracion/despachos` | 001-US2 | listado de salidas |
| `POST /api/despachos/[id]/reintentar` | 001-US2 | reintento de un fallido |

> ⚠️ **No se crea** un endpoint nuevo de reporte, ni cliente HTTP, ni worker. El wizard **arma el payload** y llama a `/api/integracion/despachos`.

## Endpoints NUEVOS (maestras, read-through, stub por defecto)
### GET /api/integracion/maestras/rutas-activas-empresa?nit=
`verifyAuth([1,2,3])`. Devuelve las rutas activas de la empresa para poblar `obj_rutas`.
- **Stub:** lista simulada de `RutaMaestra` (1–2 rutas con origen/destino/vía).
- **Real (`ClienteHttp`):** `GET {URL_MATENIMIENTOS}/maestras/rutas-activas-empresa?nit=` con **TOKEN estático/paramétrico** (según legacy `ServicioPuenteMaestras`). Auth exacta `[NEEDS CLARIFICATION]`.

### GET /api/integracion/maestras/autorizaciones?nit=&placa=&fecha=
`verifyAuth([1,2,3])`. Devuelve autorizaciones aplicables (opcional) para `array_autorizaciones`.
- **Stub:** lista simulada (posiblemente vacía).
- **Real:** `GET {URL_MATENIMIENTOS}/maestras/autorizaciones` con **TOKEN estático** (legacy). `[NEEDS CLARIFICATION]`.

> La extensión del cliente para maestras se hace con métodos `consultarRutasActivas(nit, ...)` / `consultarAutorizaciones(nit, placa, fecha)` en la interfaz `ClienteSupertransporte`, con stub (sin red) y http (solo modo real). El wizard NO llama directo a la Super.

## Flujo del wizard (UI, una sola pantalla con secciones colapsables)
1. **Cabecera** (`obj_despacho`): nit/razón social (readonly), valorTiquete, observaciones, fechaSalida (≤ hoy), horaSalida (≤ hora actual Bogota). 
2. **Consulta integradora** (gate): placa + numeroIdentificacion1 [+2] + fecha [+hora] → `POST /api/integracion/integradora/resumen`. Al responder, se **habilitan** las secciones siguientes y se **autocompletan** vehículo/conductores.
3. **Conductores** (`obj_conductores`): principal (+ secundario si aplica), autocompletado desde `integradora.conductor1/2`.
4. **Vehículo** (`obj_vehiculo`): autocompletado con pólizas/tarjeta/mantenimientos de la integradora + campos de form.
5. **Rutas** (`obj_rutas`): carga `rutas-activas-empresa`, selección → `obj_rutas`.
6. **Autorizaciones** (`array_autorizaciones`, opcional): carga `maestras/autorizaciones`, selección múltiple.
7. **Registrar despacho**: habilitado solo si (integradora + vehículo + conductores + ruta) OK; construye `RegistroDespachoIntegracion` (`salidas-payload.util` portado) y hace **UN POST** a `/api/integracion/despachos` → 202 `{solicitudId, estado}`.

## Validaciones (paridad legacy)
- Placa: `limpiarPlaca`, 5–6 `[A-Z0-9]`. · Identificación: 6–10 dígitos.
- `fechaSalida ≤ hoy(Bogota)`; `horaSalida ≤ hora actual(Bogota)`. · `numeroPasajero` 1–85 (si se usa).
- Todos los valores del payload a **string** (numéricos con `String`); `idMatenimientocorrectivo` number.

## Guardarraíl
Con `INTEGRACIONES_MODO=stub`: integradora, maestras y el reporte del worker son **simulados**; cero peticiones reales. `ClienteHttp` (integradora/maestras/transaccional) solo se instancia con el doble gate + credenciales.
