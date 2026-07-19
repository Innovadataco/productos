# Data Model: Auditoría de Operadores y Comité

**Date**: 2026-07-19
**Feature**: specs/038-auditoria-operadores-comite/spec.md

---

## Active Entities

### `AuditLog` (existente)

No se crean nuevas tablas ni migraciones. La funcionalidad se construye sobre el modelo existente:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `accion` | Enum | `AccionAudit` | Incluye `OPERADOR_*` y `COMITE_*` |
| `tipoRecurso` | String | max 50 | "usuario", "perfilOperador", "integranteComite", etc. |
| `recursoId` | String | optional | ID del recurso afectado |
| `usuarioId` | String | FK → `Usuario.id`, optional | Usuario que ejecutó la acción |
| `valorAnterior` | String | optional, max 4000 | |
| `valorNuevo` | String | optional, max 4000 | Expandible en la UI |
| `ipAddress` | String | max 45 | |
| `userAgent` | String | max 500 | |
| `metadatos` | Json | optional | Datos adicionales |
| `creadoEn` | DateTime | `@default(now())` | Orden descendente por defecto |

**Validation Rules**:
- `accion` debe ser un valor válido de `AccionAudit`.
- `recursoId` puede ser cualquier ID de recurso; no se valida contra una tabla específica para mantener flexibilidad.

### `Usuario` (existente)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | |
| `email` | String | `@unique` |
| `nombre` | String | optional |
| `rol` | Enum | `RolUsuario` |

**Relationship**: `AuditLog.usuarioId` → `Usuario.id`. La API retorna solo `nombre` y `email`.

---

## Query Patterns

### Filtros soportados

```typescript
const where: Prisma.AuditLogWhereInput = {
  accion: { in: OPERADOR_AUDIT_ACTIONS }, // o COMITE_AUDIT_ACTIONS
  creadoEn: { gte: fechaDesde, lte: fechaHasta },
  recursoId: recursoId,
  usuario: { OR: [
    { nombre: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } }
  ]}
};
```

### Paginación

```typescript
const skip = (page - 1) * pageSize;
const [items, total] = await Promise.all([
  prisma.auditLog.findMany({ where, orderBy: { creadoEn: "desc" }, skip, take: pageSize, include: { usuario: { select: { nombre: true, email: true } } } }),
  prisma.auditLog.count({ where })
]);
```

---

## Indexes

No se requieren nuevos índices para este spec. Los índices existentes en `AuditLog` (`usuarioId`, `accion`, `creadoEn`) son suficientes para los filtros iniciales. Si el volumen de auditoría crece, se puede evaluar un índice compuesto sobre `(accion, creadoEn)`.
