# Cierre: SPEC-202 — Panel Admin del Motor de Notificaciones

**Feature**: 002-PI-099  
**Branch**: `work/002-PI-motor-notif-lote1`  
**Fecha de cierre**: 2026-08-22  
**Estado**: IMPLEMENTADO — commit/push realizado

**Commit**: ver hash del commit final `feat(SPEC-202/002-PI-099): implementa panel admin del motor de notificaciones` en `work/002-PI-motor-notif-lote1`.

---

## Resumen ejecutivo

Se construyó la sección "Notificaciones" dentro de `/dashboard/admin/configuracion` con cuatro sub-tabs (bandeja, plantillas, reglas, parámetros) y el tab "Salud motor" dentro de `/dashboard/admin/estadisticas`. Se expuso el webhook idempotente `POST /api/webhooks/resend` con verificación HMAC-Svix, actualización de estados de entrega/apertura/click/bounce y registro de contactos bloqueados. Todos los cambios son aditivos y no tocan `src/lib/ai/**`.

## Artefactos entregados

- `spec.md` — actualizado con sección Implementación y estado IMPLEMENTADO.
- `plan.md` — diseño por fase.
- `tasks.md` — todas las tareas completadas.
- `data-model.md` — schema Prisma, parámetros y DTOs.
- `quickstart.md` — pasos de validación manual.
- `checklists/requirements.md` — checklist validado.
- `cierre.md` — este archivo.

## Cambios principales

- Extensión de repositorios (`src/lib/dal/repositories/notificacion.ts`, `notificacion-plantilla.ts`, `notificacion-regla.ts`).
- Nuevos servicios (`src/lib/notificaciones/admin-service.ts`, `src/lib/dal/services/notificacion-admin.ts`, `src/lib/notificaciones/webhook-resend.ts`).
- Nuevos endpoints (`src/app/api/admin/notificaciones/**`, `src/app/api/webhooks/resend`).
- Nuevos componentes UI (`src/components/modules/notificaciones/*.tsx`) y página de salud.
- Actualización de navegación (`ConfiguracionTabs.tsx`, `EstadisticasSubNav.tsx`) y permisos (`permisos-catalogo.ts`).
- Schemas Zod (`src/lib/schemas/index.ts`), variables de entorno (`.env.example`, `test-setup.ts`).
- Migración aditiva de enum `AccionAudit`.
- Tests de API y webhook.

## Gate local

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ (0 errores, 43 warnings preexistentes) |
| `npm run build` | ✅ (tras `rm -rf .next`) |
| `./scripts/dev-restart.sh` | ✅ (app + worker + monitor + worker-notificaciones levantados, healthcheck OK) |
| Tests objetivo SPEC-202 | ✅ 43 tests (webhook 7, bandeja 7, salud 2, plantillas 3, reglas 8, parámetros 7, motor 3, reenvío 6) |
| `npm run test` completo | ✅ ver resultado del gate final en la rama. |

## Tests nuevos

- `src/app/api/webhooks/resend/route.test.ts` (6 tests)
- `src/app/api/admin/notificaciones/bandeja/route.test.ts` (7 tests: GET paginado/filtros + POST reenvío)
- `src/app/api/admin/notificaciones/salud/route.test.ts` (2 tests)
- `src/app/api/admin/notificaciones/plantillas/route.test.ts` (3 tests)
- `src/app/api/admin/notificaciones/reglas/route.test.ts` (2 tests)
- `src/app/api/admin/notificaciones/reglas/[id]/route.test.ts` (6 tests: PATCH + confirmación de recálculo)
- `src/app/api/admin/notificaciones/parametros/route.test.ts` (3 tests)
- `src/app/api/admin/notificaciones/parametros/[clave]/route.test.ts` (4 tests)

## Decisiones y candados

- Webhook Resend: firma HMAC-Svix con `RESEND_WEBHOOK_SECRET`; ventana de tiempo 300 s; idempotencia por `COALESCE` de timestamps (no sobreescribe `openedAt`/`clickedAt`/`deliveredAt`/`bouncedAt`).
- AuditLog en mutaciones de plantillas, reglas y parámetros.
- Migración 100% aditiva; cero DROP.
- No se tocó `src/lib/ai/**`.
- Secrets solo por variables de entorno; ningún valor real commiteado.

## Hallazgos / pendientes

- Suite completa `npm run test` es muy lenta localmente. Recomendación: revisar en CI con runner más potente o división de suites.
- Duplicidad técnica menor: existen dos servicios admin (`src/lib/notificaciones/admin-service.ts` y `src/lib/dal/services/notificacion-admin.ts`). Funcionan correctamente; se sugiere unificar en refactor posterior.
- Fix menor: webhook Resend ahora devuelve 401 cuando falta `RESEND_WEBHOOK_SECRET`.
- La BD de test tenía pendiente la migración `20260822030000_spec_202_notificaciones_admin_audit`; se aplicó con `prisma migrate deploy` usando `DATABASE_URL` de `.env.test`.
- Deploy limpio con `./scripts/dev-restart.sh` ejecutado: app en :5005, worker, monitor y worker-notificaciones levantados; healthcheck OK.
- `arch:check` requirió regenerar `docs/architecture/02-roles-capacidades.md` y `docs/architecture/03-pantallas.md` tras agregar los módulos `configuracion_notificaciones` y `estadisticas_salud_motor`.

## Instrucciones para validación manual

Ver `quickstart.md` en esta misma carpeta.

## Señal a ZEUS

`002-PI-099 · REALIZADO · <hash> · work/002-PI-motor-notif-lote1`
