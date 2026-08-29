# Feature Specification: Gestión de credenciales de padres desde admin (I-37)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Status**: IMPLEMENTADO (SIN push ni deploy; el coordinador de la cola empuja en serie y ZEUS gatea release)

## Contexto

Incidencia I-37 (detectada por el CEO): el administrador de plataforma NO puede ver ni
gestionar las cuentas de usuarios finales (`PARENT`), como sí hace con operadores
(`src/app/api/admin/operadores/**`) y colegios (`src/app/api/admin/colegios/**`). El día
que un padre pierda su contraseña no hay soporte posible: nadie puede restablecerla ni
desactivar una cuenta comprometida.

**Guardas**: implementar y commitear en `feature/001-scaffolding`, **SIN PUSH ni deploy**
(el coordinador de la cola empuja en serie; el deploy lo gatea ZEUS).

## User Stories

- **US-1 (P1)**: Como admin, quiero listar las cuentas de padres con búsqueda y paginación
  para localizar la cuenta de un usuario que pide soporte.
  - AS-1.1: `GET /api/admin/padres` devuelve `{ items, pagination }` (page/pageSize,
    default 25, máx 100) con id, email, nombre, estado, `debeCambiarPassword`, fecha de
    registro, última sesión y N de reportes (solo el conteo agregado).
  - AS-1.2: `?q=` filtra por email o nombre (case-insensitive).
  - AS-1.3: un token `PARENT` u `OPERADOR` recibe 403; sin token, 401.
- **US-2 (P1)**: Como admin, quiero restablecer la contraseña de un padre para devolverle
  el acceso sin conocer jamás su contraseña.
  - AS-2.1: `POST /api/admin/padres/[id]/restablecer-password` genera una contraseña
    temporal, la devuelve UNA vez en la respuesta, marca `debeCambiarPassword=true` y
    registra AuditLog. El admin nunca ve la contraseña anterior (solo hash en BD).
  - AS-2.2: si el id no existe o no es `PARENT`, 404.
- **US-3 (P1)**: Como admin, quiero desactivar/reactivar la cuenta de un padre para
  cortar el acceso ante una cuenta comprometida.
  - AS-3.1: `DELETE /api/admin/padres/[id]` marca `estado=inactivo` (idempotente) y
    registra AuditLog.
  - AS-3.2: `POST /api/admin/padres/[id]/reactivar` marca `estado=activo` (idempotente)
    y registra AuditLog.
  - AS-3.3: el login de un padre desactivado falla y NO reactiva la cuenta.
- **US-4 (P2)**: Como admin, quiero una entrada de menú y una pantalla para estas
  acciones, con el mismo patrón visual que operadores/colegios.

### Edge Cases

- Id con formato inválido → 400 (Zod), no 500.
- Desactivar una cuenta ya inactiva / reactivar una ya activa → 200 idempotente, sin
  duplicar AuditLog (patrón operadores).
- Búsqueda sin resultados → `items: []` con `total: 0`.
- `pageSize > 100` → 400 (Zod), nunca paginación ilimitada.

## Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/admin/padres` con paginación estándar
  (`{ items, pagination: { page, pageSize, total, totalPages } }`), búsqueda `q` por
  email/nombre y conteo agregado de reportes por cuenta.
- **FR-002**: El sistema DEBE exponer `POST /api/admin/padres/[id]/restablecer-password`
  que regenere el hash, devuelva la contraseña temporal solo en esa respuesta (nunca en
  logs ni auditoría), fuerce `debeCambiarPassword=true` y registre AuditLog.
- **FR-003**: El sistema DEBE exponer `DELETE /api/admin/padres/[id]` (desactivar) y
  `POST /api/admin/padres/[id]/reactivar` (reactivar), ambos idempotentes y auditados.
- **FR-004**: Toda ruta DEBE exigir `verifyAuth("ADMIN")` + `assertModulo(admin, "padres")`
  + rate limit (`admin_read`/`admin_write`), y validar entrada con Zod.
- **FR-005**: El login (`POST /api/auth/login`) DEBE rechazar cuentas con
  `estado=inactivo` tras verificar la contraseña, sin reactivarlas.
- **FR-006**: El listado NO DEBE exponer textos de reportes, identificadores reportados
  ni datos de menores: solo metadatos de cuenta y conteos agregados (privacidad §1).
- **FR-007**: El menú admin DEBE incluir la entrada "Padres" gobernada por el módulo
  `padres` del catálogo (`src/lib/permisos-catalogo.ts`), y la página
  `/dashboard/admin/padres` DEBE verificar el módulo server-side.

## Success Criteria

- **SC-001**: Tests verdes: listado solo-admin (padre/operador → 403), búsqueda filtra,
  paginación estándar, restablecer → hash cambia + `debeCambiarPassword=true` + AuditLog,
  desactivar → login del padre desactivado falla y la cuenta sigue inactiva.
- **SC-002**: El test estructural `nav-items.test.ts` sigue verde (módulo `padres` con
  ítem de menú).
- **SC-003**: Gate verde (tsc + lint + tests + build) bajo candado de cola.
- **SC-004**: Sin migración de schema (se verifica y se justifica en plan.md).

## Assumptions

- Los padres se auto-registran (`/register`); el admin NO crea cuentas de padre (a
  diferencia de operadores/colegios). La gestión es soporte: listar, restablecer,
  activar/desactivar.
- No se reenvía la contraseña temporal por email en este bloque (el alta de colegio sí
  envía email; aquí el patrón mínimo coherente es mostrarla una vez al admin, igual que
  `regenerar-password` de operadores, que no envía email).
- Acciones de auditoría: se reutiliza `USER_UPDATE` con diffs estructurados (decisión
  justificada en plan.md; evita migración de enum en cola paralela).

## Implementación

**Fecha**: 2026-07-29 · **Cola**: 002-PI-041, bloque B3 · **Estado**: commiteado en
`feature/001-scaffolding`, **SIN push ni deploy** (coordinador empuja; ZEUS gatea release).

- **US-1**: `GET /api/admin/padres` (`src/app/api/admin/padres/route.ts`) — listado
  paginado `{ items, pagination: { page, pageSize, total, totalPages } }` (default 25,
  máx 100 vía `padresQuerySchema` en `src/lib/validators.ts`), búsqueda `q` por
  email/nombre (insensitive), conteo agregado de reportes por `groupBy` (sin contenido).
- **US-2**: `POST /api/admin/padres/[id]/restablecer-password` — temp `randomBytes(6).hex`
  devuelta una sola vez (nunca persistida en claro ni auditada), `debeCambiarPassword=true`,
  AuditLog `USER_UPDATE` con diff `{ debeCambiarPassword }`.
- **US-3**: `DELETE /api/admin/padres/[id]` (desactivar) y
  `POST /api/admin/padres/[id]/reactivar` (reactivar), ambos idempotentes (sin duplicar
  auditoría) y auditados con diff `{ estado }`. Login (`src/app/api/auth/login/route.ts`)
  rechaza `estado=inactivo` tras verificar la contraseña, sin reactivarla.
- **US-4**: módulo `padres` en `src/lib/permisos-catalogo.ts` (crítico, orden 25), ítem
  "Padres" en `src/lib/nav-items.ts`, icono en `AdminNav.tsx`, página
  `src/app/dashboard/admin/padres/page.tsx` (server, `verificarAccesoPagina`) +
  `PadresPageClient.tsx` (búsqueda, tabla, paginación, banner de contraseña de una sola
  muestra). Textos en español neutro.
- **Sin migración de schema** (SC-004 verificado): módulos de permisos se siembran por
  upsert desde el catálogo; auditoría reutiliza `USER_UPDATE` (justificación en plan.md §3).
- **Pruebas**: 18 tests nuevos en 4 archivos bajo `src/app/api/admin/padres/**`
  (rojo confirmado → verde). Gate: tsc ✅ · lint ✅ (0 errores) · tests tocados 86/86 ✅ ·
  build ✅ · suite completa bajo candado (detalle en cierre.md).
