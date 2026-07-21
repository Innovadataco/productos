# Research — Spec 079: Colegio acceso y auditoría

## Reutilización de patrones existentes

### Gestión de acceso de operadores (Parte 2)

- `src/app/api/admin/operadores/[id]/regenerar-password/route.ts`:
  - Verifica `ADMIN`.
  - `randomBytes(6).toString("hex")` para contraseña temporal.
  - `hashPassword` + `debeCambiarPassword: true`.
  - `logAudit` con `OPERADOR_PASSWORD_REGENERADA` o `COMITE_PASSWORD_REGENERADA`.
  - Devuelve `passwordTemporal` en la respuesta.

- `src/app/api/admin/operadores/[id]/reenviar-email/route.ts`:
  - Similar a regenerar, pero usa `enviarEmailBienvenidaOperador` o `enviarEmailBienvenidaComite`.
  - Registra `OPERADOR_EMAIL_REENVIADO` o `COMITE_EMAIL_REENVIADO`.
  - Si el envío falla, devuelve `passwordTemporal` para copia manual.

- Para colegios se propone:
  - Nuevas acciones de auditoría ya existentes: `COLEGIO_PASSWORD_REGENERADA`, `COLEGIO_EMAIL_REENVIADO`.
  - Helpers de email: `enviarEmailBienvenidaColegio` (a crear, adaptando `enviarEmailBienvenidaOperador`).
  - Endpoint: `/api/admin/colegios/[id]/regenerar-password` y `.../reenviar-email`.

### Vista de auditoría (Parte 3)

- `src/app/dashboard/admin/operadores/auditoria/page.tsx` usa `AuditLogViewer` con `OPERADOR_AUDIT_ACTIONS`.
- `src/app/dashboard/admin/comite/auditoria/page.tsx` similar con `COMITE_AUDIT_ACTIONS`.
- `src/lib/audit-actions.ts` define los grupos de acciones por prefijo.
- Para colegios se agregaría `COLEGIO_AUDIT_ACTIONS` filtrando `AccionAudit` que empiece por `COLEGIO_`.

## Gap del modelo `AuditLog`

Actualmente `AuditLog` tiene:

- `usuarioId`: quién ejecutó la acción.
- `recursoId`: sobre qué recurso.
- `accion`: qué acción.
- `metadatos`: JSON opcional.

No tiene un campo que indique a qué colegio pertenece la acción. Esto es crítico para el aislamiento.

## Estrategias de aislamiento consideradas

### Opción A: filtrar por `usuarioId` del SCHOOL_ADMIN

- Se podría filtrar `AuditLog` donde `usuarioId` sea el SCHOOL_ADMIN del colegio.
- Problemas:
  - Acciones realizadas por el ADMIN sobre un colegio no aparecerían.
  - Acciones realizadas por otros roles futuros tampoco aparecerían.
  - No hay garantía estricta de aislamiento; un bug podría mostrar acciones de otro SCHOOL_ADMIN.

### Opción B: agregar `colegioId` nullable a `AuditLog`

- Migración aditiva: `ALTER TABLE "AuditLog" ADD COLUMN "colegioId" TEXT;` (nullable).
- Relación Prisma: `AuditLog.colegio Colegio? @relation(fields: [colegioId], references: [id], onDelete: SetNull)`.
- Todas las acciones `COLEGIO_*` registran `colegioId`.
- El endpoint `/api/colegio/auditoria` filtra `where: { colegioId: usuario.colegioId, accion: { in: COLEGIO_AUDIT_ACTIONS } }`.
- Aislamiento estricto y verificable por tests.

**Recomendación**: Opción B. Es la única que garantiza que un colegio vea solo sus propias acciones, independientemente de quién las ejecute.

## Acciones `COLEGIO_*` existentes en el enum

Las 19 acciones ya definidas en `AccionAudit`:

- `COLEGIO_CREADO`
- `COLEGIO_ACTUALIZADO`
- `COLEGIO_DESACTIVADO`
- `COLEGIO_REACTIVADO`
- `COLEGIO_PASSWORD_REGENERADA`
- `COLEGIO_EMAIL_REENVIADO`
- `COLEGIO_CURSO_CREADO`
- `COLEGIO_CURSO_EDITADO`
- `COLEGIO_CURSO_DESACTIVADO`
- `COLEGIO_ALUMNO_CREADO`
- `COLEGIO_ALUMNO_EDITADO`
- `COLEGIO_ALUMNO_DESACTIVADO`
- `COLEGIO_IDENTIFICADOR_CREADO`
- `COLEGIO_IDENTIFICADOR_EDITADO`
- `COLEGIO_IDENTIFICADOR_DESACTIVADO`
- `COLEGIO_CARGA_MASIVA`
- `COLEGIO_ALERTA_CREADA`
- `COLEGIO_ALERTA_ESTADO`
- `COLEGIO_ESTADISTICAS_PDF_DESCARGADO`

## Notas de seguridad

- La contraseña temporal se genera con `crypto.randomBytes(6).toString("hex")` (12 caracteres hex). Es el mismo mecanismo de operadores.
- No se persiste en BD; solo se transmite una vez en la respuesta JSON.
- La UI debe mostrarla con opción de copiar y una advertencia de "muéstrela una vez".
- No se envía por email la contraseña en texto plano si no se puede garantizar entrega; si falla, se muestra en UI.

## Notas de UI/UX

- Usar `/skill:ui-ux-pro-max` para el diseño del modal de credenciales y la vista de auditoría del colegio.
- Reutilizar `AuditLogViewer` para mantener consistencia con operadores y comité.
- El tema verde (`theme-colegio`) debe aplicarse a la vista `/dashboard/colegio/auditoria`.
