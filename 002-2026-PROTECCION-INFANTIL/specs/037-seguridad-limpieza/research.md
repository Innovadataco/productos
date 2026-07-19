# Research: Fixes de seguridad y limpieza

**Date**: 2026-07-19
**Feature**: specs/037-seguridad-limpieza/spec.md

---

## Decisions

### D1: Reutilizar `checkRateLimit` existente

**Decision**: Aplicar el helper `checkRateLimit` de `src/lib/rate-limit.ts` a los endpoints admin que aún no lo invocan, en lugar de introducir un nuevo mecanismo.

**Rationale**: El helper ya está probado, centralizado y parametrizable por `ParametroSistema`. Reutilizarlo cumple con la constitución §6.4 sin aumentar la superficie de ataque ni la complejidad operativa.

**Scopes**:
- `admin_read`: ventana de 60s, 60 requests por defecto.
- `admin_write`: ventana de 60s, 30 requests por defecto.

### D2: No modificar seed, migraciones ni middleware

**Decision**: Los cambios son aditivos en el código de rutas; no se tocan migraciones, seed ni middleware.

**Rationale**: La tabla `RateLimit` ya existe y se usa en otros endpoints. El helper falla abierto si hay problemas de BD, por lo que no se requiere alteración de schema.

### D3: Sanitizar el mensaje de error en transiciones

**Decision**: Reemplazar `motivo: `Error de procesamiento: ${errMsg}`` y `metadatos: { error: errMsg }` por un mensaje genérico y un código de error.

**Rationale**: Los mensajes crudos pueden contener PII, trazas de stack, rutas internas o mensajes de servicios de terceros. La auditoría debe ser segura y predecible.

### D4: No agregar nuevas dependencias

**Rationale**: El spec no requiere librerías nuevas. El trabajo se limita a imports y llamadas existentes.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Introducir un rate limiter a nivel de middleware | Requeriría tocar middleware, violando la restricción de no alterar lógica central de specs 035/036. |
| Cambiar schemas de Prisma para soportar rate limit por IP | No es necesario; `RateLimit` ya existe. |
| Persistir mensaje de error en tabla separada para admins | Aumenta superficie de datos sensibles y no estaba en el scope. |
| Usar `console.error` en lugar de transición de error | No reemplaza la traza de auditoría ni la acción de fallback a `REVISION_MANUAL`. |

---

## Open Questions (0 remaining)

Ninguna. El scope está acotado a cambios aditivos en rutas y al mensaje de transición.
