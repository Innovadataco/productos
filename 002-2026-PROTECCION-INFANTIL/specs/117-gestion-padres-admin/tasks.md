# Tasks — Spec 117: Gestión de credenciales de padres desde admin (I-37)

## Fase 1 — Tests primero (rojo)

- [x] T001 [P] Test `src/app/api/admin/padres/route.test.ts`: listado solo admin
  (PARENT/OPERADOR → 403, sin token → 401), búsqueda `q` filtra por email/nombre,
  paginación estándar, solo rol PARENT, conteo de reportes, sin datos de reportes.
- [x] T002 [P] Test `src/app/api/admin/padres/[id]/restablecer-password/route.test.ts`:
  hash cambia + `debeCambiarPassword=true` + AuditLog `USER_UPDATE` + contraseña temporal
  en respuesta (login con ella funciona) + 404 si no es PARENT + 403 no-admin.
- [x] T003 [P] Test `src/app/api/admin/padres/[id]/route.test.ts` (DELETE): desactiva +
  AuditLog + idempotente + login del padre desactivado falla (401) y sigue inactivo
  (importa `POST` de `api/auth/login/route`; ROJO hasta T008) + 403 no-admin.
- [x] T004 [P] Test `src/app/api/admin/padres/[id]/reactivar/route.test.ts`: reactiva +
  AuditLog + idempotente + login vuelve a funcionar.

Rojo confirmado: 4 archivos fallaban por rutas inexistentes antes de implementar.

## Fase 2 — Implementación API (verde)

- [x] T005 `padresQuerySchema` en `src/lib/validators.ts` y `padreIdParamsSchema` en
  `src/lib/schemas/index.ts`.
- [x] T006 `GET /api/admin/padres` (`route.ts`): verifyAuth("ADMIN") + assertModulo
  "padres" + rate `admin_read` + paginación + búsqueda + conteo agregado de reportes.
- [x] T007 `POST /api/admin/padres/[id]/restablecer-password` y `DELETE`/`POST reactivar`
  en `[id]/`: guards + Zod + AuditLog `USER_UPDATE` (diff estructurado), idempotentes.
- [x] T008 Login: rechazar `estado=inactivo` tras verificar contraseña en
  `src/app/api/auth/login/route.ts` (sin tocar flujo `bloqueado`).

## Fase 3 — Permisos y UI

- [x] T009 Clave `padres` en `src/lib/permisos-catalogo.ts` + ítem en
  `src/lib/nav-items.ts` + icono en `src/components/modules/AdminNav.tsx`
  (mantiene verde `nav-items.test.ts`).
- [x] T010 Página `src/app/dashboard/admin/padres/page.tsx` (server, verifica módulo) +
  `PadresPageClient.tsx` (búsqueda, tabla, paginación, restablecer con banner de una sola
  muestra, activar/desactivar). Español neutro.

## Fase 4 — Cierre

- [x] T011 Gate bajo candado: `npx tsc --noEmit` + `npm run lint` + tests tocados (86/86) +
  `npm run build`; suite completa `npm run test` al final.
- [x] T012 `cierre.md` + sección Implementación en `spec.md` (Status → IMPLEMENTADO).
  **SIN PUSH ni deploy** (coordinador empuja; ZEUS gatea release).
- [x] T013 Commits selectivos (rutas explícitas `002-2026-PROTECCION-INFANTIL/...`),
  español imperativo: US-1..US-3 (API+tests), US-4 (UI), docs.
