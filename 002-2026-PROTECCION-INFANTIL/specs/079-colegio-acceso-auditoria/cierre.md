# Cierre — Spec 079: Colegio acceso y auditoría

**Fecha**: 2026-07-23
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/079-colegio-acceso-auditoria/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS para marcar CERRADA

## Ajustes de aprobación aplicados

1. **Parte 1 (vigencia) FUERA DE ALCANCE**: ya implementada en `97cdf95a` (`vigencia.test.ts` 5/5 verificado el 2026-07-23). No se re-implementó.
2. **[NEEDS CLARIFICATION] resuelto con Opción B**: `AuditLog.colegioId` nullable, migración aditiva. Opción A descartada por frágil (aislamiento de tenant es requisito de seguridad).

## Resumen por User Story

| US | Descripción | Estado |
|----|-------------|--------|
| US1 (P1) | Fix de vigencia | Fuera de alcance (ya hecho; verificado) |
| US2 (P1) | Restablecer contraseña del SCHOOL_ADMIN | Implementado + test 3/3 |
| US3 (P1) | Mostrar contraseña temporal una sola vez | Implementado (creación ya lo tenía; restablecer/reenviar ahora también) |
| US4 (P2) | Reenviar email de credenciales | Implementado + test 3/3 |
| US5 (P1) | Auditoría del colegio para SCHOOL_ADMIN | Implementado + tests FR-008 5/5 |

## Cambios realizados

**Parte 2 — Acceso**
- `src/app/api/admin/colegios/[id]/regenerar-password/route.ts` (NUEVO): solo ADMIN; temporal `randomBytes(6).hex`; `debeCambiarPassword: true`; `COLEGIO_PASSWORD_REGENERADA` con `colegioId`. La temporal solo viaja en la respuesta — nunca se persiste en claro ni se loguea (verificado por test: ni `passwordHash` ni el `AuditLog` la contienen).
- `src/app/api/admin/colegios/[id]/reenviar-email/route.ts` (NUEVO): nueva temporal + `enviarEmailBienvenidaColegio`; si el envío falla, la temporal se devuelve para copia manual; `COLEGIO_EMAIL_REENVIADO` con `colegioId`.
- `src/app/dashboard/admin/colegios/page.tsx`: botones "Restablecer contraseña" / "Reenviar email" por colegio + bloque ámbar con la temporal una sola vez (estado local, se descarta al cerrar).

**Parte 3 — Auditoría (Opción B)**
- Migración aditiva `20260723013000_add_audit_log_colegio_id`: `AuditLog.colegioId TEXT` + índice + FK `ON DELETE SET NULL`. Aplicada en dev y test. Sin tocar datos existentes.
- `src/lib/audit.ts`: `logAudit` acepta `colegioId`.
- 16 call sites de acciones `COLEGIO_*` ahora registran `colegioId` (12 rutas `/api/colegio/**`, 4 `/api/admin/colegios/**`, 2 en `lib/colegio/alertas.ts`).
- `GET /api/colegio/auditoria` (NUEVO): SCHOOL_ADMIN + vigencia; `where.colegioId = user.colegioId` SIEMPRE + acciones `COLEGIO_*` (filtros del viewer acotados a ese conjunto); paginación estándar.
- `AuditLogViewer`: prop `endpoint` (default `/api/admin/audit-logs`, sin romper usos existentes); `AUDIT_ACTION_GROUPS` gana grupo "Colegios".
- Vista `/dashboard/colegio/auditoria` + entrada en `ColegioNav`.

## Validación

- Tests nuevos: 11/11 (FR-008 aislamiento 5/5, regenerar 3/3, reenviar 3/3).
- Gate: lint 0 errores (1 warning heredado) · `tsc --noEmit` OK · **753/753 tests** · `rm -rf .next && npm run build` OK · `dev-restart.sh` healthcheck OK.
- En vivo (colegio `cmrwwckzx0003gd0u8df7q0cr`):
  - POST regenerar-password → `passwordTemporal` en respuesta + `COLEGIO_PASSWORD_REGENERADA` con `colegioId` en BD.
  - Login SCHOOL_ADMIN con la temporal → OK, `debeCambiarPassword: true`.
  - `GET /api/colegio/auditoria` como SCHOOL_ADMIN → solo acciones de su colegio (la acción `COLEGIO_CREADO` histórica sin `colegioId` queda correctamente excluida).
  - `GET /api/colegio/auditoria` como ADMIN → 403 (aislamiento de rol).
  - POST reenviar-email → `emailEnviado: true`, sin exponer temporal + `COLEGIO_EMAIL_REENVIADO` auditado.
  - Página `/dashboard/colegio/auditoria` → 200.

## Deuda técnica registrada

- Las acciones `COLEGIO_*` registradas antes de esta spec no tienen `colegioId` → no aparecen en la vista del colegio (comportamiento correcto por diseño; si se quisiera histórico, haría falta backfill con heurística por `recursoId`, fuera de alcance).
- El flujo de cambio de contraseña (`debeCambiarPassword`) para SCHOOL_ADMIN se validó por login (flag activo); el cambio guiado en UI es del módulo de auth existente.

## Commit

- `feat(colegios): restablecer/reenviar credenciales + auditoría aislada del colegio (spec 079)`
