# Research: SPEC-155 — Timeline "Ver proceso"

## Modelos

- `TransicionReporte`: estado anterior/nuevo, responsable tipo/id, motivo, metadatos, fecha.
- `ReintentoReporte`: intento, exitoso, error, fecha.

## Patrones

- SPEC-096 (expediente reporte): ya expone traza del modelo; este timeline es complementario con estados y reintentos.
- API admin existente en `src/app/api/admin/**`.

## Hallazgos

- Ambos modelos tienen índice por `reporteId`.
- No es necesario modificar schema.
