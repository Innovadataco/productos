# Modelo de datos — SPEC-207

## Cambios en schema

Ninguno. No hay migración ni modificación de `schema.prisma`.

## Cambios en seed

- `spam.dominancia_umbral` → valor `"0.33"` (update forzado en `RUBRICA_SEMILLA`).
- `spam.dominios_acortadores` → JSON con lista de dominios acortadores.
