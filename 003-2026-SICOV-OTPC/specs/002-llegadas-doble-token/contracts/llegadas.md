# Contrato — Integración de llegadas con doble token (P1)

> Reutiliza toda la maquinaria de la feature 001-US2 (`ClienteSupertransporte` stub/real, `TokenProveedorStore`, `construirCabeceras`, herencia rol 3, worker table-driven). **Guardarraíl:** stub por defecto; modo real bloqueado hasta verificación humana.

## Doble token (idéntico a despachos)
`Authorization: Bearer <tokenExterno>` · `token: <tokenAutorizado>` · `documento: <nitVigilado>` · `Content-Type: application/json`. Resolución vía `construirCabeceras(identificacion, idRol)` (herencia rol 3).

## POST /api/integracion/llegadas  (encolar)
Registra una llegada y la encola.
**Request** (sesión requerida):
```json
{ "placa": "ABC123", "tipoLlegada": 1, "idDespacho": 42, "payload": { ... } }
```
(o el payload completo del formulario de llegada; `placa` y `tipoLlegada` obligatorios)

**Proceso**
1. `verifyAuth([1,2,3])`.
2. Resolver contexto efectivo (herencia rol 3) → `nitVigilado`, `usuarioId`.
3. Validar `placa` y `tipoLlegada` (400 si faltan).
4. Insertar en `tbl_llegadas_solicitudes`: `estado='pendiente'`, `procesado=false`, `siguiente_intento=now`, `placa`, `tipo_llegada`, `id_despacho?`, `nit_vigilado`, `usuario_id`, `rol_id`, `payload`.

**Response 202** `{ solicitudId, estado: "pendiente" }`
**Errores:** 400, 401, 403, 500.

## Worker (reusa el patrón de despachos)
POST a `{URL_DESPACHOS}/llegadasempresas` con las 3 cabeceras. Extrae id con **`extraerIdLlegadaExterno`** (candidatos, verificados en legacy `ClienteApiSupertransporte`): `obj.obj.id | obj.id | obj.idLlegada | data.idLlegada | data.id | idLlegada | id`. Persiste `id_llegada_externo` / `respuesta_externa` (éxito) o `error_externo` + reintentos (fallo, backoff 5 min, máx 3 → `fallido`).

> **Nota de arquitectura (a decidir en plan):** añadir un segundo loop al mismo worker (un supervisor, dos colas: despachos + llegadas) o `procesarLoteLlegadas` en el mismo `worker-despachos.mjs`. Recomendado: **un solo worker con dos pasadas** (despachos y llegadas) bajo el mismo advisory lock, para no multiplicar procesos.

## POST /api/llegadas/[id]/reintentar
`verifyAuth([1,2,3])` → `estado='pendiente'`, `reintentos=0`, `siguiente_intento=now`, `error_externo=null`, `procesado=false`. (Corrige el mismo antipatrón que despachos.)

## GET /api/integracion/llegadas  (listado paginado server-side)
`?page=&pageSize=` → `{ items, pagination{page,pageSize,total,totalPages} }`. Filtrado por NIT efectivo (rol 1 admin ve todo). Paridad con el listado paginado del legacy (`res.data` + `res.meta.total`).

## Dashboard
`GET /api/dashboard` agrega `llegadasHoy` = `count(fecha_creacion >= inicioDiaBogota())` para el vigilado.

## Endpoint externo (solo modo real; URL no secreta)
`POST {URL_DESPACHOS}/llegadasempresas`.
