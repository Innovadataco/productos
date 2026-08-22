# Contracts · API admin/pagos · SPEC-212

Todas las rutas requieren rol `ADMIN`. Respuesta paginada estándar: `{ items, pagination: { page, pageSize, totalPages, totalItems } }`.

## `GET /api/admin/pagos/pendientes`

Lista pagos con estado `PENDIENTE_AUTORIZACION`.

**Query params:** `page`, `pageSize` (max 100), `q` (opcional, búsqueda por email/identificador).

**Response 200:**
```json
{
  "items": [{
    "id": "...",
    "suscripcionId": "...",
    "cliente": { "tipo": "COLEGIO|PADRE", "nombre": "...", "email": "..." },
    "montoBaseUSD": 100,
    "montoNetoUSD": 85,
    "monedaLocal": "COP",
    "montoLocalPagado": 350000,
    "metodoDeclarado": "TRANSFERENCIA",
    "fechaReporte": "...",
    "comprobanteAdjuntoUrl": "..."
  }],
  "pagination": { "page": 1, "pageSize": 25, "totalPages": 1, "totalItems": 3 }
}
```

## `POST /api/admin/pagos/pendientes/[id]/autorizar`

Autoriza un pago pendiente.

**Body:** `{ "duracionCubierta": "MES_3", "planId": "...", "notas": "..." }` (plan y duración pueden ser opcionales si ya están en el pago).

**Response 200:** pago actualizado.

## `POST /api/admin/pagos/pendientes/[id]/rechazar`

Rechaza un pago pendiente.

**Body:** `{ "motivo": "..." }` (requerido, min 10 chars).

**Response 200:** pago actualizado.

## `GET /api/admin/pagos/vencimientos`

Suscripciones `ACTIVA` con `fechaFin <= hoy + 7 días`.

**Query params:** `page`, `pageSize`, `dias` (default 7).

## `GET /api/admin/pagos/mora`

Suscripciones en `EN_GRACIA` o `SUSPENDIDA`.

**Query params:** `page`, `pageSize`, `estado`.

## `GET /api/admin/pagos/bonos`

Lista bonos promocionales.

## `POST /api/admin/pagos/bonos`

Crea bono.

**Body:** campos de `BonoPromocional` validados con Zod.

## `PATCH /api/admin/pagos/bonos/[id]`

Edita bono.

## `POST /api/admin/pagos/bonos/[id]/desactivar`

Desactiva bono (baja lógica).

## `GET /api/admin/pagos/planes`

Lista planes con filtros `tipoTitular`, `anio`.

## `PATCH /api/admin/pagos/planes/[id]`

Edita precio/descuento de un plan.

**Body:** `{ "precioBaseUSD": number, "descuentoAnualPct": number|null }`

## `GET /api/admin/pagos/reembolsos`

Lista pagos `AUTORIZADO` e histórico de `REEMBOLSADO`.

## `POST /api/admin/pagos/reembolsos/[id]`

Registra reembolso de un pago `AUTORIZADO`.

**Body:** `{ "montoReembolsoUSD": number, "motivoReembolso": "...", "referenciaReembolso": "..." }`

## `GET /api/admin/pagos/cliente/[id]`

Ficha completa de cliente/suscripción.

**Response 200:** `{ "suscripcion": {...}, "pagos": [...], "eventos": [...] }`

## `POST /api/admin/pagos/cliente/[id]/extender`

Extensión manual de vigencia.

**Body:** `{ "nuevaFechaFin": "...", "motivo": "..." }`
