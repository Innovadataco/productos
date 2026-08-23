# Modelo de datos — SPEC-206

## Cambios en schema (aditivos)

### Nuevo enum `MotivoCierreSesion`

```prisma
enum MotivoCierreSesion {
  LOGOUT
  INACTIVIDAD
  FORZADA
}
```

### Nuevo modelo `SesionLog`

```prisma
model SesionLog {
  id                  String             @id @default(cuid())
  usuarioId           String
  tenantId            String?
  rol                 RolUsuario
  iniciadaEn          DateTime           @db.Timestamptz(6)
  ultimaActividadEn   DateTime           @db.Timestamptz(6)
  cerradaEn           DateTime?          @db.Timestamptz(6)
  motivoCierre        MotivoCierreSesion?
  duracionMin         Int?
  ipHash              String
  userAgent           String?
  creadoEn            DateTime           @default(now())
  actualizadoEn       DateTime           @updatedAt

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId, iniciadaEn DESC])
  @@index([tenantId, iniciadaEn DESC])
  @@index([cerradaEn, ultimaActividadEn])
  @@index([creadoEn])
  @@map("sesiones_log")
}
```

### Ajustes aditivos a modelos existentes

- Añadir relación inversa en `Usuario`:
  ```prisma
  sesionesLog SesionLog[]
  ```
- Añadir valores a `AccionAudit`:
  - `SESION_FORZADA_CIERRE`
  - `SESION_CIERRE_INACTIVIDAD`

### Migración SQL

- Crear enum `MotivoCierreSesion`.
- Crear tabla `sesiones_log` con columnas e índices.
- Añadir valores al enum `AccionAudit` (`ALTER TYPE ... ADD VALUE`).
- Añadir FK `sesiones_log.usuarioId -> Usuario(id)` con `ON DELETE CASCADE`.

## Entidades involucradas

### `Usuario`
- Campos clave: `id`, `email`, `nombre`, `rol`, `estado`, `tenantId`, `colegioId`.
- Nueva relación `sesionesLog` para joins de listado.

### `SesionLog`
- Una fila por inicio de sesión explícito.
- `cerradaEn IS NULL` ⇒ sesión activa.
- `motivoCierre` se llena al cerrar: `LOGOUT` (futuro), `INACTIVIDAD` (worker), `FORZADA` (admin).
- `duracionMin` se calcula al cerrar: `ROUND(EXTRACT(EPOCH FROM (cerradaEn - iniciadaEn)) / 60)`.

### `ParametroSistema`
- `sesion.timeout_inactividad_minutos` (INTEGER, default 30).
- `sesion.ping_intervalo_minutos` (INTEGER, default 5).
- `sesion.retencion_dias` (INTEGER, default 90).
- `sesion.worker_intervalo_minutos` (INTEGER, default 5).

### `AuditLog`
- `SESION_FORZADA_CIERRE`: admin fuerza cierre; `recursoId = sesionLogId`.
- `SESION_CIERRE_INACTIVIDAD`: worker cierra lote; `metadatos = { cerradas: N }`.

## Consideraciones de privacidad

- `ipHash` es irreversible gracias a `ANTI_ABUSO_SALT` (mínimo 32 chars) y al truncamiento previo a `/24` (IPv4) o `/64` (IPv6).
- `userAgent` se trunca a 256 caracteres antes de guardar.
- La UI solo muestra los últimos 4 caracteres hexadecimales del hash.
