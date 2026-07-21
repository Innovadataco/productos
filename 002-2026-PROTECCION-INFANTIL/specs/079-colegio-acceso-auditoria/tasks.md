# Tasks — Spec 079: Colegio acceso y auditoría

## Phase 1 — Fix de vigencia (implementar ahora)

- **T001** [P] Corregir comparación de fechas en `src/lib/colegio/vigencia.ts`.
  - Ruta: `src/lib/colegio/vigencia.ts`
  - Dependencias: ninguna.
  - Notas: usar `hoyNormalizado()` y `normalizarFechaServicio()` para inicio y fin.

- **T002** [P] Agregar tests unitarios de vigencia.
  - Ruta: `src/lib/colegio/vigencia.test.ts`
  - Dependencias: T001.
  - Notas: casos hoy, mañana, ayer, fin hoy.

## Phase 2 — Gestión de acceso (plan, esperar aprobación)

- **T003** [P] Endpoint regenerar contraseña del SCHOOL_ADMIN.
  - Ruta: `src/app/api/admin/colegios/[id]/regenerar-password/route.ts`
  - Dependencias: aprobación Parte 2.
  - Notas: reutilizar patrón de operadores; acción `COLEGIO_PASSWORD_REGENERADA`.

- **T004** [P] Endpoint reenviar email de bienvenida.
  - Ruta: `src/app/api/admin/colegios/[id]/reenviar-email/route.ts`
  - Dependencias: aprobación Parte 2.
  - Notas: crear helper `enviarEmailBienvenidaColegio` en `src/lib/email.ts`; acción `COLEGIO_EMAIL_REENVIADO`.

- **T005** [P] UI de credenciales temporales en creación/restablecimiento de colegio.
  - Ruta: `src/app/dashboard/admin/colegios/page.tsx` y `src/app/dashboard/admin/colegios/[id]/page.tsx`
  - Dependencias: T003, T004.
  - Notas: modal/toast con copia de contraseña; mostrar una sola vez.

- **T006** [P] Tests de endpoints y UI de acceso.
  - Ruta: `src/app/api/admin/colegios/[id]/regenerar-password/route.test.ts`, `.../reenviar-email/route.test.ts`
  - Dependencias: T003, T004.
  - Notas: ADMIN OK, no ADMIN 403, colegio sin admin 404.

## Phase 3 — Auditoría del colegio (plan, esperar aprobación)

- **T007** [P] Migración aditiva `AuditLog.colegioId`.
  - Ruta: `prisma/migrations/YYYYMMDDHHmmss_add_audit_log_colegio_id/migration.sql` + `prisma/schema.prisma`
  - Dependencias: aprobación Parte 3 (Opción B).
  - Notas: nullable, onDelete SetNull, índice.

- **T008** [P] Poblar `colegioId` en acciones `COLEGIO_*` existentes.
  - Ruta: archivos que llaman `logAudit` con acciones COLEGIO_*.
  - Dependencias: T007.
  - Notas: identificar todos los logAudit de COLEGIO_* y pasar `colegioId`.

- **T009** [P] Endpoint `GET /api/colegio/auditoria`.
  - Ruta: `src/app/api/colegio/auditoria/route.ts`
  - Dependencias: T007, T008.
  - Notas: verifyAuth SCHOOL_ADMIN; filtrar por `colegioId` y acciones COLEGIO_*.

- **T010** [P] Vista `/dashboard/colegio/auditoria`.
  - Ruta: `src/app/dashboard/colegio/auditoria/page.tsx`
  - Dependencias: T009.
  - Notas: reutilizar `AuditLogViewer` con `COLEGIO_AUDIT_ACTIONS`.

- **T011** [P] Tests de aislamiento y funcionalidad de auditoría.
  - Ruta: `src/app/api/colegio/auditoria/route.test.ts`
  - Dependencias: T009, T010.
  - Notas: SCHOOL_ADMIN ve solo su colegio; otro SCHOOL_ADMIN no ve nada; ADMIN no afectado.

## Phase 4 — Validación y cierre (post-implementación)

- **T012** [P] Validar tsc, lint, tests y build.
  - Dependencias: T002, T006, T011.
  - Notas: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- **T013** [P] Deploy limpio y quickstart.
  - Dependencias: T012.
  - Notas: `./scripts/dev-restart.sh`; probar pasos del quickstart.

- **T014** [P] Documentación de cierre.
  - Ruta: `specs/079-colegio-acceso-auditoria/spec.md`, `specs/079-colegio-acceso-auditoria/cierre.md`
  - Dependencias: T013.
  - Notas: sección Implementation, evidencia, commits, deuda técnica.
