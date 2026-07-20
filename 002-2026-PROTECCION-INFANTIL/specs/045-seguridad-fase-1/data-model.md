# Data Model: Seguridad Fase 1 — Saneamiento de Auth

**Date**: 2026-07-20
**Feature**: specs/045-seguridad-fase-1/spec.md

---

## Active Entities (sin cambios de schema)

### `RateLimit`

Entidad existente utilizada por `checkRateLimit`. Se agregan dos scopes nuevos en los defaults de código, no en base de datos:

| Scope | Ventana por defecto | Máximo por defecto | Identificador |
|-------|---------------------|--------------------|---------------|
| `recuperar_solicitar` | 3600 s | 5 | IP + email |
| `verificacion_solicitar` | 3600 s | 5 | IP + email |

Los valores se pueden ajustar vía parámetros de sistema:
- `ratelimit.recuperar_solicitar.window_seconds`
- `ratelimit.recuperar_solicitar.max_requests`
- `ratelimit.verificacion_solicitar.window_seconds`
- `ratelimit.verificacion_solicitar.max_requests`

**Notas**:
- No se requiere migración; `RateLimit` ya existe.
- `checkRateLimit` crea dinámicamente filas por `key` compuesto.

### `Usuario`

Sin cambios en esta fase. Los datos personales del usuario se consideran para el plan de borrado seguro (US3) pero no se modifica el modelo.

### `CodigoVerificacion` y `TokenRecuperacion`

Sin cambios de schema. El límite de 3 códigos/tokens activos por email en 1 hora sigue vigente en la lógica de negocio. El rate limit nuevo es una capa adicional por IP e identificador.

---

## Base Entities (sin cambios)

No se crean ni modifican tablas en esta fase.

---

## Entity Relationships

```text
RateLimit (registro dinámico de contadores por scope/identificador/ventana)
Usuario ||--o{ CodigoVerificacion : "solicita"
Usuario ||--o{ TokenRecuperacion : "recibe"
```

---

## Seed Data (sin cambios)

No se agregan datos de seed. Los parámetros de rate limit para los scopes nuevos son opcionales; si no existen, `checkRateLimit` usa los valores por defecto del archivo fuente.

---

## Indexes (sin cambios)

No se agregan índices. `RateLimit` ya tiene clave primaria en `key`.
