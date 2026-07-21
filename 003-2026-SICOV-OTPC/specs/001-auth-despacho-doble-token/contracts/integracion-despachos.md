# Contrato — Integración de despachos con doble token (P1)

> Reimplementación fiel del cliente real `ClienteApiSupertransporte` + `TokenExterno` + `DespachosQueueService` (legacy AdonisJS). **GUARDARRAÍL:** el consumo real de la Super está detrás de una interfaz con **stub por defecto**; el modo real exige `INTEGRACIONES_MODO=real` + `SUPERTRANSPORTE_HABILITADO=true` + credenciales, y **no se activa hasta verificación humana**.

## Los tres tokens (verificado en legacy)
| Token | Cabecera | Origen |
|---|---|---|
| **tokenExterno** (proveedor) | `Authorization: Bearer <tokenExterno>` | Login externo del aplicativo con `EXTERNAL_APP_USER`/`EXTERNAL_APP_PASSWORD` contra `EXTERNAL_APP_LOGIN_URL`; **cacheado en memoria (singleton) con auto-refresh**. NO depende del usuario. |
| **tokenAutorizado** (vigilado) | `token: <tokenAutorizado>` | `usn_token_autorizado` del usuario (o del administrador si rol 3) |
| **documento** (NIT) | `documento: <nitVigilado>` | `usn_identificacion` del usuario (o del administrador si rol 3) |

`Content-Type: application/json` siempre. (Referencia legacy: `ClienteApiSupertransporte.obtenerHeadersTransaccionales`.)

## Interfaz interna (Next.js)
```ts
interface ClienteSupertransporte {
  postTransaccional(url, body, identificacion: string, idRol: number): Promise<RespuestaExterna>
  // arma las 3 cabeceras resolviendo herencia rol 3, refresca tokenExterno si vence
}
```
Dos implementaciones: **`ClienteStub`** (default) y **`ClienteHttp`** (real, gate doble). Factory `getClienteSupertransporte()` elige por env. Los tests usan siempre stub o `vi.mock`.

### TokenExterno (store singleton)
Réplica de `TokenExterno.ts`:
```ts
class TokenProveedorStore {
  private token: string | null
  private expiraEn: number | null      // epoch s; null => sin expiración conocida
  private refreshEnCurso: Promise<string> | null   // dedupe concurrente
  async get(): Promise<string|null>    // vigente ? token : refresh()
  isVigente(): boolean                 // token && (expiraEn==null || now < expiraEn - margen)
  async refresh()                      // login externo (stub|real), set(token)
  clear()
}
```
- En **stub**: `refresh()` devuelve `stub-token-<ts>` con vigencia simulada; jamás llama a la red.
- En **real**: `refresh()` hace POST a `EXTERNAL_APP_LOGIN_URL` `{usuario, contrasena}` → toma `respuesta.token`.
- Mejora sobre el legacy: aplicar **margen de expiración** real (el legacy, al no recibir `expiraEn`, considera el token vigente indefinidamente; aquí forzamos refresh por margen/TTL configurable).

## Herencia del subusuario (rol 3) — regla crítica
Réplica de `obtenerDatosAutenticacionUsuario(identificacion, idRol)`:
```
si idRol === 3:
  admin = usuario cuyo usn_identificacion == usuario.usn_administrador   // join lógico por identificación
  si !admin || !admin.tokenAutorizado -> Error 400 (config)
  tokenAutorizacion = admin.usn_token_autorizado
  nitVigilado       = admin.usn_identificacion
si no (rol 1/2):
  tokenAutorizacion = usuario.usn_token_autorizado
  nitVigilado       = usuario.usn_identificacion
si !tokenAutorizacion -> 400 "Token de autorización no encontrado…"
si !nitVigilado       -> 400 "No se pudo determinar el vigilado…"
```
> ⚠️ `usn_administrador` contiene la **identificación** del administrador (no su `usn_id`). El join es por `usn_identificacion`.

## POST /api/integracion/despachos (encolar)
Registra un despacho. Paridad con `POST /api/v1/integracion/despachos` (un solo POST atómico).

**Request** (sesión requerida): `{ obj_despacho, obj_vehiculo, obj_conductores, obj_rutas, array_autorizaciones? }` (estructura del wizard de salidas; todos los valores se normalizan a **string** antes de reportar, como exige la Super).

**Proceso**
1. `verifyAuth()` → obtiene `{ sub, rol, nit }` de la sesión.
2. Resolver contexto efectivo (herencia rol 3) → `nitVigilado`, `usuarioId`.
3. (Opcional, config) `ValidacionProveedor`: proveedor con `tpv_documento==nit`, `tpv_estado=true`, `hoy∈[tpv_fecha_inicial, tpv_fecha_final]`; si no → 401. *(En legacy la ruta de integración usa solo JWT; la validación de contrato se aplica en otras rutas. Se deja como flag `VALIDAR_CONTRATO_DESPACHO`.)*
4. Normalizar payload (strings, `limpiarPlaca`).
5. Insertar en `tbl_despachos_solicitudes`: `estado='pendiente'`, `procesado=false`, `siguiente_intento=now`, `nit_vigilado`, `usuario_id`, `rol_id`, `payload`.
6. (Patrón legacy "envía-ya") intentar `enviarSolicitud` en el mismo request; si error 5xx → dejar `pendiente` (+5min) para el worker; si 4xx → `fallido`. En 003 podemos encolar y dejar todo al worker (más simple y testeable con stub).

**Response 202/200** `{ solicitudId, estado }` (y `idDespachoExterno` si el envío síncrono tuvo éxito).
**Errores:** 400 (payload/contexto), 401 (sesión/tokenExterno vencido), 403, 500.

## Worker table-driven (reemplaza `setInterval` del demo; corrige bugs 1 y 2)
Réplica de `DespachosQueueService.procesarLote` + `start/despachos_queue_worker.ts`:
```
loop:
  solicitudes = SELECT * FROM tbl_despachos_solicitudes
      WHERE estado='pendiente' AND procesado=false AND siguiente_intento <= now
      ORDER BY des_sol_id ASC LIMIT 20         // usa índice (estado, siguiente_intento)
  for s in solicitudes:
    s.estado='procesando'; save
    try:
      resp = cliente.postTransaccional(URL_DESPACHOS/despachosempresa, s.payload, s.usuario_id, s.rol_id)
      s.idDespachoExterno = extraerIdDespachoExterno(resp)   // candidatos: obj.obj.id, obj.id, data.id, id
      s.respuestaExterna = resp; s.errorExterno=null; s.procesado=true; s.estado='procesado'; save
    catch e:
      s.errorExterno = extraerMensaje(e)        // trunc 300
      s.reintentos += 1
      if s.reintentos >= 3: s.estado='fallido'; save          // terminal, reintentable manual
      else: s.estado='pendiente'; s.siguiente_intento = now + 5min; save
  if nada: sleep(1s)     // backoff idle
```
- **Instancia única:** advisory lock (`SELECT pg_try_advisory_lock(<ID_003>)` vía Prisma `$queryRaw`) en un supervisor (`scripts/worker-supervisor.mjs` + `scripts/worker-despachos.mjs`), patrón de 002. `ID_003` distinto al de 002.
- **Corrige Bug 1** (reintento no reseteaba contador): aquí el estado/`siguiente_intento`/`reintentos` se gestionan atómicamente; un `fallido` reintentado manualmente vuelve a `pendiente`, `siguiente_intento=now`, y **resetea `reintentos=0`**.

## POST /api/despachos/[id]/reintentar (reintento manual; corrige bug 2)
`verifyAuth()` → marca la solicitud `estado='pendiente'`, `reintentos=0`, `siguiente_intento=now`, `errorExterno=null`. El worker la retoma. La UI (log de cola) llama a este endpoint con **handler funcional** (el demo tenía el botón sin `onClick`).

## Normalización tolerante (verificado)
- IDs de respuesta: `extraerIdDespachoExterno` prueba `resp.obj.obj.id → resp.obj.id → resp.data.id → resp.id`, primer numérico > 0.
- Errores externos → mensaje `resp.data.mensaje || resp.data.message || error.message`; status `resp.status || 500`.
- Respuestas de listado toleran `array_data | data | obj`.

## Endpoints externos (solo modo real; URLs no secretas)
| Uso | Endpoint |
|---|---|
| Crear despacho | `POST {URL_DESPACHOS}/despachosempresa` |
| Consulta integradora | `POST {URL_INTEGRADORA}/api-integradora/resumen` |
| Login proveedor (tokenExterno) | `POST {EXTERNAL_APP_LOGIN_URL}` `{usuario, contrasena}` |
| Llegadas (feature siguiente) | `POST {URL_DESPACHOS}/llegadasempresas` |

## Notas de seguridad (no portar del legacy)
- ❌ No copiar el `console.log({url, body, headers})` de `postTransaccional` (filtra tokens).
- ❌ No copiar el default hardcodeado de `TOKEN_PARAMETRICO`; exigir env var.
- 🔴 Rol **9 no existe** en el backend legacy (solo 1/2/3, +5/7 PESV). Confirmar con el responsable si debe crearse o si el HANDOFF lo asumió.
