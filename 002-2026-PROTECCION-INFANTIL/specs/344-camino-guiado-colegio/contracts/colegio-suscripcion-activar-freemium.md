# Contract · POST /api/colegio/suscripcion/activar-freemium

**Purpose**: activar la prueba institucional (30 días freemium
parametrizable) para el colegio, cerrando el Paso 2 del camino y escribiendo
`Colegio.finServicio` (puente D2 · R6).

## Request

```
POST /api/colegio/suscripcion/activar-freemium
Cookie: token=…; __Host-token=…; sesion_estado=…
Content-Type: application/json

{}   // sin body; se lee el colegioId del usuario autenticado
```

## Auth

- Requiere sesión de rol `SCHOOL_ADMIN`.
- Middleware: exento del guardián del camino (`camino.exentasSchoolAdmin`
  incluye `/api/colegio/suscripcion`) para no crear un ciclo cuando el paso
  Plan no está cumplido y este endpoint es lo que lo cumple.

## Response

**201 Created** (primera activación):

```json
{
  "ok": true,
  "suscripcion": {
    "id": "cmt…",
    "esFreemium": true,
    "estado": "ACTIVA",
    "fechaInicio": "2026-09-01T…",
    "freemiumFechaFin": "2026-10-01T…"
  },
  "colegio": {
    "id": "cmt…",
    "finServicio": "2026-10-01T…"   // ← puente D2
  },
  "redirectTo": "/camino/colegio/profesores"
}
```

**200 OK** (ya había freemium activa, idempotente): mismo body sin cambios.

Sellado: la cookie `sesion_estado` se re-emite vía
`sellarCookieSesionEstado` con `pasoCamino: "profesores"` (o el siguiente
pendiente si el rector ya cargó profesores).

## Errores

- 401 `no_autenticado`.
- 403 `rol_incorrecto`.
- 409 `plan_pagado_activo` — el colegio ya tiene un plan pagado; freemium
  no aplica.
- 500 `interno`.

## Efectos secundarios (transaccionales)

1. Crea `Suscripcion { colegioId, esFreemium: true, estado: "ACTIVA",
   freemiumFechaFin: hoy + pagos.freemium.duracion_dias }`.
2. Actualiza `Colegio.finServicio = freemiumFechaFin` (R6, puente D2).
3. Sella cookie `sesion_estado`.
4. `AuditLog { accion: "colegio.freemium.activado", entidad: "Colegio",
   entidadId, actorId }`.

## Puente barato al D2 (R6 · matiz CEO 03:18)

Este endpoint reescribe `Colegio.finServicio` con la ventana correspondiente
usando `calcularFinServicio` de A-64 (para freemium: días parametrizados;
para pagado: por `Plan.duracion`). Con esto un colegio nuevo NO queda
"gratis para siempre" al pasar por el camino. La unificación profunda
(vigencia colegio ← Suscripción) queda para otra spec del brief.
