# Contrato — Consulta integradora (P1)

> Verificación **en vivo, de solo lectura, síncrona**. Usa **solo** `Authorization: Bearer <tokenExterno>` (no el doble token saliente). **Guardarraíl:** stub por defecto; el modo real (consumo productivo) exige doble gate + credenciales y queda bloqueado hasta verificación humana.

## Diferencia clave vs despachos/llegadas
| | Despachos/Llegadas (transaccional) | Integradora (consulta) |
|---|---|---|
| Naturaleza | escritura/reporte | **lectura/verificación** |
| Ejecución | cola + worker (asíncrono) | **síncrona** (respuesta directa) |
| Cabeceras | **3** (Authorization + token + documento) | **1**: `Authorization: Bearer <tokenExterno>` |
| Persistencia | `tbl_*_solicitudes` | **ninguna** |

> **Nota de verificación (research):** en el legacy, `ClienteApiSupertransporte.postIntegradora` delega en `postTransaccional`, que **sí** arma las 3 cabeceras; en cambio el frontend (`DashboardService`/`BaseApiService.postIntegradora`) llama la integradora con **solo** el `tokenExterno`. Hay inconsistencia. **Por instrucción del responsable, el 003 usa solo `tokenExterno`.** Confirmar al conectar el modo real.

## Interfaz interna (extensión del cliente)
```ts
interface ClienteSupertransporte {
  postTransaccional(...): Promise<RespuestaExterna>;      // despachos/llegadas (3 cabeceras)
  consultarIntegradora(body: SolicitudIntegradora): Promise<RespuestaIntegradora>; // solo Bearer tokenExterno
}
```
- `ClienteStub.consultarIntegradora`: NUNCA toca red; devuelve `RespuestaIntegradora` simulada (documentos vigentes).
- `ClienteHttp.consultarIntegradora`: `POST {URL_INTEGRADORA}/api-integradora/resumen` con `Authorization: Bearer <getTokenProveedor()>` y `Content-Type: application/json`; timeout `TIMEOUT_INTEGRADORA_MS` (default 100 s); normaliza `parsed.obj ?? parsed`. **Solo instanciable en modo real.**

## POST /api/integracion/integradora/resumen
**Request** (sesión requerida):
```json
{ "placa": "ABC123", "numeroIdentificacion1": "123456", "numeroIdentificacion2": "789",
  "nit": "900853057", "fechaConsulta": "2026-07-21", "horaConsulta": "08:00" }
```

**Proceso**
1. `verifyAuth([1,2,3])`.
2. `placa = limpiarPlaca(...)`; validar `placa` y `numeroIdentificacion1` (400).
3. Si `fechaConsulta` ≠ hoy(Bogota) → requerir `horaConsulta` (400 si falta).
4. `nit` = body.nit ?? NIT efectivo de sesión.
5. `cliente.consultarIntegradora(body)` (stub o real).
6. Normalizar y devolver `RespuestaIntegradora`.

**Response 200** → `RespuestaIntegradora` (ver data-model).
**Errores:** 400 (input), 401, 404/estructura vacía (sin datos), 502 (upstream), 504 (timeout), 500.

## Pantalla de consulta
`/dashboard/integradora` (o embebida): formulario **placa + numeroIdentificacion1 (+ 2) + fecha (+ hora)**; al enviar, muestra:
- **Conductor(es):** identificación, nombres, licencia (estado+vencimiento), alcoholimetría (resultado+fecha), examen médico, aptitud física.
- **Vehículo:** placa, clase, SOAT (número+vencimiento), RTM (número+vencimiento).
- **Pólizas** (contractual/extracontractual), **tarjeta de operación**, mantenimientos/alistamiento, empresa.
Estados vencidos resaltados. La pantalla aclara que es una **consulta informativa en vivo**, no un veredicto persistente.

## Endpoint externo (solo modo real; URL no secreta)
`POST {URL_INTEGRADORA}/api-integradora/resumen`.
