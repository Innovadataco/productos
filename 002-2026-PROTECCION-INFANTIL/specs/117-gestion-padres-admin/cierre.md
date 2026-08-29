# Cierre — Spec 117: Gestión de credenciales de padres desde admin (I-37)

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Cola**: 002-PI-041, bloque B3 ·
**Estado**: IMPLEMENTADA Y COMMITEADA, **SIN PUSH ni deploy** (el coordinador empuja en serie;
ZEUS gatea release).

## Lo hecho

- **US-1 — Listado**: `GET /api/admin/padres` (`src/app/api/admin/padres/route.ts`).
  Paginación estándar `{ items, pagination: { page, pageSize, total, totalPages } }`
  (default 25, máx 100, `padresQuerySchema` en `src/lib/validators.ts`), búsqueda `q` por
  email/nombre case-insensitive, campos de cuenta (estado, `debeCambiarPassword`, registro,
  última sesión) y conteo agregado de reportes (`groupBy`, `eliminado:false`).
  **Privacidad**: sin textos, identificadores ni datos de menores (test lo verifica).
- **US-2 — Restablecer contraseña**: `POST /api/admin/padres/[id]/restablecer-password`.
  Temporal `randomBytes(6).hex` devuelta UNA vez en la respuesta (nunca persistida en claro,
  nunca en auditoría — test lo verifica), `debeCambiarPassword=true`, AuditLog. El admin
  nunca ve la contraseña anterior: se reemplaza el hash y se fuerza el cambio.
- **US-3 — Activar/desactivar**: `DELETE /api/admin/padres/[id]` y
  `POST /api/admin/padres/[id]/reactivar`, patrón operadores (idempotentes, sin duplicar
  auditoría). **Login** (`src/app/api/auth/login/route.ts`): guarda nueva — cuenta
  `inactivo` con contraseña correcta → 401 "Cuenta desactivada" y NO se reactiva (antes el
  reseteo de lockout la marcaba `activo`: bug latente que hacía inútil la desactivación).
  Se verifica tras la contraseña para no filtrar existencia/estado. Flujo `bloqueado` intacto.
- **US-4 — UI**: módulo `padres` en el catálogo (`src/lib/permisos-catalogo.ts`, crítico,
  orden 25), ítem "Padres" en `src/lib/nav-items.ts`, icono en `AdminNav.tsx`, página
  `/dashboard/admin/padres` (server `verificarAccesoPagina` + `PadresPageClient.tsx`:
  búsqueda, tabla, paginación, banner de contraseña de una sola muestra). Español neutro.

## Decisiones (justificación en plan.md)

- **Sin migración de schema** (SC-004): el módulo `padres` se siembra por upsert desde el
  catálogo (`prisma/seed.ts` backfill ADMIN; tests vía `otorgarTodosLosPermisos`).
- **Auditoría con `USER_UPDATE`** + diff estructurado (`{ estado }` / `{ debeCambiarPassword }`)
  en vez de valores `PADRE_*` nuevos del enum: un `ALTER TYPE` tocaría la BD de test
  compartida en una cola con agentes en paralelo; la trazabilidad queda completa con el diff.
- **Sin creación de cuentas ni reenvío de email**: los padres se auto-registran; el patrón
  mínimo coherente (como `regenerar-password` de operadores) es mostrar la temporal una vez.

## Pruebas (Regla 3) — TDD

- Rojo confirmado: los 4 archivos de test fallaban por rutas inexistentes antes de implementar.
- 18 tests nuevos (`src/app/api/admin/padres/**`): listado solo-admin (PARENT/OPERADOR → 403,
  sin token → 401), `q` filtra, paginación (pageSize>100 → 400), solo rol PARENT, conteo
  agregado sin fuga de contenido; restablecer → hash cambia + `debeCambiarPassword=true` +
  AuditLog + temporal entra y la vieja no + 404 no-PARENT + 400 id inválido; desactivar →
  login falla (401) y la cuenta sigue inactiva; reactivar → login vuelve; idempotencia sin
  duplicar auditoría; 403 no-admin en todas.

## Gate (bajo candado `/tmp/pi-gate-lock`)

- `npx tsc --noEmit` ✅ (0 errores)
- `npm run lint` ✅ (0 errores; 1 warning preexistente en `IaModelSelector.tsx`, ajeno)
- Tests tocados ✅ **86/86** (padres 18 + nav-items + AdminNav + schemas + validators +
  login-comite + cambiar-password + journeys operador-comite/colegio + colegios)
- `npm run build` ✅ (exit 0)
- Suite completa `npm run test` ✅ **1062/1063** (1 skipped): el único fallo es
  `specs-discipline.test.ts` "índice specs/README.md cubre todas las carpetas" por
  `117-gestion-padres-admin` (esta spec) y `121-error-wrapper-ollama-timeout` (otro agente)
  **sin indexar — esperado**: `specs/README.md` lo gestiona el coordinador de la cola
  (anotado según reglas del bloque; ningún otro test falla).

## Despliegue (Regla 4) — DIFERIDO

**Sin push ni deploy** (reglas del bloque: el coordinador empuja en serie; el deploy lo
gatea ZEUS). Validación interina = gate verde + diff revisable. Nota de operación: la clave
de módulo `padres` se activa para ADMIN con el próximo `npm run db:seed` (upsert idempotente
del catálogo); hasta entonces la pantalla/API responden 403 por denegación por defecto
(comportamiento seguro del sistema de permisos).

## Deuda

- Ninguna nueva. Deuda preexistente hecha visible (no corregida, fuera de alcance): el login
  reactivaba cuentas `inactivo` de CUALQUIER rol con la contraseña correcta; la guarda nueva
  lo corrige para todos los roles como efecto colateral deseado.
