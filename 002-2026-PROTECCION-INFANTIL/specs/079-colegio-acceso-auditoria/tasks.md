# Tasks — Spec 079: Colegio acceso y auditoría

**Spec**: `specs/079-colegio-acceso-auditoria/spec.md` · **Fecha**: 2026-07-23

## Parte 1 — Fix de vigencia (FUERA DE ALCANCE por ajuste de ZEUS)

- [x] T001 Verificado: ya implementada en commit `97cdf95a`; `vigencia.test.ts` 5/5 pasa. No se re-implementó.

## Parte 2 — Gestión de acceso del colegio

- [x] T002 `POST /api/admin/colegios/[id]/regenerar-password` (+test 3/3): temporal aleatoria, `debeCambiarPassword: true`, `COLEGIO_PASSWORD_REGENERADA` con `colegioId`; contraseña solo en la respuesta (nunca persistida en claro ni logueada).
- [x] T003 `POST /api/admin/colegios/[id]/reenviar-email` (+test 3/3): nueva temporal + `enviarEmailBienvenidaColegio`; si el envío falla, temporal en respuesta para copia manual; `COLEGIO_EMAIL_REENVIADO` con `colegioId`.
- [x] T004 UI listado admin/colegios: botones "Restablecer contraseña" y "Reenviar email" + bloque ámbar con la temporal una sola vez (mismo patrón del flujo de creación).

## Parte 3 — Auditoría del colegio (Opción B aprobada)

- [x] T005 Migración aditiva `20260723013000_add_audit_log_colegio_id` (`AuditLog.colegioId` nullable, FK `ON DELETE SET NULL`, índice) + schema + `logAudit({ colegioId })`.
- [x] T006 `colegioId` poblado en los 16 call sites de acciones `COLEGIO_*` (rutas `/api/colegio/**`, `/api/admin/colegios/**`, `lib/colegio/alertas.ts`).
- [x] T007 `GET /api/colegio/auditoria`: SCHOOL_ADMIN + vigencia, filtro forzado `colegioId` propio + acciones `COLEGIO_*`, mismos filtros/paginación del viewer admin.
- [x] T008 Vista `/dashboard/colegio/auditoria` (AuditLogViewer con prop `endpoint`) + entrada "Auditoría" en `ColegioNav` + grupo "Colegios" en `AUDIT_ACTION_GROUPS`.
- [x] T009 Tests de aislamiento FR-008 (5/5): colegio A nunca ve B, sin `colegioId` excluido, no-`COLEGIO_*` excluido, filtro por acción, 403 otros roles, 401 sin auth.

## Cierre

- [x] T010 Gate: lint 0 errores · tsc OK · 753/753 tests · build limpio · `dev-restart.sh` healthcheck OK.
- [x] T011 Validación en vivo (colegio `cmrwwckzx0003gd0u8df7q0cr`): regenerar → login con temporal → auditoría propia visible; reenviar email OK; ADMIN → 403 en endpoint de colegio.
- [x] T012 Docs: cierre.md, sección Implementation en spec.md, índice.
- [x] T013 Commit: `feat(colegios): restablecer/reenviar credenciales + auditoría aislada del colegio (spec 079)`.
