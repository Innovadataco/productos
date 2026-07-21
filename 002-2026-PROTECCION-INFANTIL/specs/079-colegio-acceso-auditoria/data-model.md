# Data Model — Spec 079: Colegio acceso y auditoría

## Cambios propuestos

### 1. Fix de vigencia (sin cambio de modelo)

No se modifica el schema. Solo cambia la lógica de comparación en `src/lib/colegio/vigencia.ts` para usar `normalizarFechaServicio()` y `hoyNormalizado()`.

### 2. Gestión de acceso (sin cambio de modelo)

No se modifica el schema. Se reutilizan `Usuario.passwordHash` y `Usuario.debeCambiarPassword`. Se crean endpoints que operan sobre el `Usuario` con `rol = SCHOOL_ADMIN` y `colegioId` del colegio.

### 3. Auditoría del colegio (migración aditiva)

#### Nuevo campo en `AuditLog`

```prisma
model AuditLog {
  // ... campos existentes ...
  colegioId String?
  colegio   Colegio? @relation(fields: [colegioId], references: [id], onDelete: SetNull)

  @@index([colegioId])
}
```

- Tipo: `String?` (nullable).
- Relación: `Colegio?` con `onDelete: SetNull`.
- Índice: `@@index([colegioId])` para consultas rápidas.
- Migración: `add_audit_log_colegio_id` (aditiva, no destructiva).

#### Impacto en el modelo `Colegio`

```prisma
model Colegio {
  // ... campos existentes ...
  auditLogs AuditLog[]
}
```

#### Uso del campo

- Acciones `COLEGIO_*` registradas por el sistema o el admin deben incluir `colegioId`.
- Acciones no relacionadas con colegios dejarán `colegioId` como null.
- El endpoint `/api/colegio/auditoria` filtrará por `colegioId` del SCHOOL_ADMIN autenticado.

## Backward compatibility

- `AuditLog` sin `colegioId` sigue siendo válido; las vistas de admin/operador/comité no se ven afectadas.
- Las acciones históricas `COLEGIO_*` que no tengan `colegioId` simplemente no aparecerán en la vista del colegio; no se rompe nada.
- Si se desea, se puede ejecutar un backfill para completar `colegioId` en registros históricos a partir de `recursoId` y `accion`, pero no es obligatorio para el funcionamiento.

## Restricciones de seguridad

- `colegioId` en `AuditLog` es solo informativo; no se usa para autorización.
- El endpoint `/api/colegio/auditoria` debe verificar que el usuario autenticado sea `SCHOOL_ADMIN` y que tenga `colegioId` asignado.
