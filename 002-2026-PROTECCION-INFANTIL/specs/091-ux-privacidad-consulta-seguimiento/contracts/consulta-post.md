# Contracts — 091-ux-privacidad-consulta-seguimiento

## POST /api/consulta (NUEVO — cliente web)

**Request**: `Content-Type: application/json` — `{ "identificador": "+57300…" }` (3..100 chars).
**Response**: idéntico contrato que `GET /api/consulta` (spec 089): `tieneReportes`, `actividad`, `totalReportes`, `reportesAutenticados`, `reportesAnonimos`, `plataformas`, `resumenPlataformas`, `categorias`, `ubicaciones`, `autenticado` (+ detalle autenticado). **Sin `nivelRiesgo` ni score.**
**Errores**: 400 identificador ausente/inválido · 429 rate limit.
**Privacidad**: el identificador NUNCA viaja en query string (el test lo verifica).

## GET /api/consulta (conservado)

Compatibilidad de API externa; sin cambios de contrato. El cliente web ya no lo usa.

## Transporte del RPT (no es contrato HTTP)

`sessionStorage["seguimiento.rpt"]`: el home lo escribe al enviar el campo RPT; `SeguimientoClient` lo lee una vez y lo elimina. `/seguimiento?numero=` sigue funcionando (compat).

## Data Model

**Sin cambios de schema ni de datos.** No se requiere migración.
