# Data Model — SPEC-196

## Cambios

Ningún modelo nuevo. Solo extensión aditiva del enum `AccionAudit`:

```prisma
enum AccionAudit {
  // ... valores existentes ...
  IP_BLOQUEADA
  IP_DESBLOQUEADA
  IP_DESBLOQUEADA_MANUAL  // ← NUEVO (002-PI-090)
  // ...
}
```

## Migración

```sql
ALTER TYPE "AccionAudit" ADD VALUE 'IP_DESBLOQUEADA_MANUAL';
```

No se modifica la tabla `BlockList`; la IP en claro solo transita por el endpoint y se hashea antes de persistir.

## Tablas involucradas (solo lectura/auditoría)

- `BlockList` — lectura de bloqueos vigentes, eliminación al desbloquear.
- `AuditLog` — escritura de `IP_DESBLOQUEADA_MANUAL`.
