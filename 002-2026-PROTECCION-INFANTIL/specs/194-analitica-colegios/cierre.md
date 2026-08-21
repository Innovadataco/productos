# Cierre SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT (002-PI-088)

## Resumen

- **Feature**: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT
- **Rama**: `work/002-pi-088`
- **Objetivo**: cerrar I-37 (admin sin vista de usuarios PARENT registrados) y añadir analítica agregada de colegios en `/dashboard/admin/estadisticas/operacion`.
- **Estado**: implementado y listo para merge a `feature/001-scaffolding`.

## Artefactos entregados

### Backend
- `src/lib/analytics/cache.ts` — caché en memoria con TTL para endpoints de analytics.
- `src/lib/analytics/parametros.ts` — lectura de parámetros `analytics.colegios.*`.
- `src/lib/analytics/hallazgos-colegio.ts` — generación de hallazgos positivos/negativos y semáforo.
- `src/lib/analytics/usuarios-query.ts` — query paginada de usuarios por rol (PARENT por defecto).
- `src/lib/dal/repositories/analytics-colegio.ts` — agregaciones SQL tenant-first para resumen y ficha.
- `src/lib/dal/repositories/analytics-colegio-helpers.ts` — helpers de agregación reutilizables.
- `src/lib/dal/repositories/analytics-colegio-types.ts` — tipos de salida del repositorio.
- `src/app/api/admin/usuarios/route.ts` — `GET /api/admin/usuarios` (rol, filtros, paginación).
- `src/app/api/admin/usuarios/[id]/route.ts` — detalle de usuario con metadatos de reportes.
- `src/app/api/admin/analytics/colegios/route.ts` — resumen de colegios con caché.
- `src/app/api/admin/analytics/colegios/[id]/route.ts` — ficha de 7 secciones.

### Frontend
- `src/app/dashboard/admin/usuarios/page.tsx` — sub-tab "Padres" por defecto.
- `src/app/dashboard/admin/usuarios/[id]/page.tsx` — detalle de padre.
- `src/app/dashboard/admin/estadisticas/operacion/colegios/[colegioId]/page.tsx` — ficha detalle.
- `src/components/modules/admin/AdminUsuariosTable.tsx`
- `src/components/modules/admin/AdminUsuariosFilters.tsx`
- `src/components/modules/admin/AdminUsuariosDetalle.tsx`
- `src/components/modules/admin/AdminAnalyticsColegiosTable.tsx`
- `src/components/modules/admin/AdminAnalyticsColegiosFilters.tsx`
- `src/components/modules/admin/AdminAnalyticsColegioFicha.tsx`

### Infraestructura
- `prisma/migrations/20260821110000_spec_194_analytics_indexes/migration.sql` — índices aditivos para `Reporte`, `AlertaColegio`, `SolicitudComite`.
- `prisma/seed.ts` — 5 parámetros nuevos sembrados (`analytics.colegios.*`).
- `src/lib/nav-items.ts`, `src/lib/permisos-catalogo.ts` — módulos `usuarios_admin` y `analytics_colegios`.
- `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx` — sub-tab "Colegios".
- `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx` — extensión del tablero.
- `src/components/modules/config-panel/types.ts` — sección "Analítica → Colegios" en configuración.
- `src/lib/validators.ts` — schemas Zod de query params.
- `docs/architecture/02-roles-capacidades.md`, `docs/architecture/03-pantallas.md` — regenerados por `arch:check`.

### Tests
- `src/app/api/admin/usuarios/route.test.ts` (5 tests)
- `src/app/api/admin/usuarios/[id]/route.test.ts` (3 tests)
- `src/app/api/admin/analytics/colegios/route.test.ts` (4 tests)
- `src/app/api/admin/analytics/colegios/[id]/route.test.ts` (3 tests)

## Gate local

- `npx tsc --noEmit` → verde
- `npm run lint -- --no-cache` → 0 errores (42 warnings preexistentes)
- `npm run arch:check` → verde (tras regenerar `02-roles-capacidades.md` y `03-pantallas.md`)
- `npm run test -- --run` → verde
- `npm run build` → verde

## Decisiones relevantes

- Caché en memoria con TTL configurable (default 5 min); no se invalida automáticamente al cambiar parámetros, el TTL lo hace.
- Hallazgos generados con reglas if/else sobre umbrales; sin IA.
- Comparación con la mediana de colegios activos; si hay < 3 colegios se reporta "insuficientes datos".
- La ruta legacy `/dashboard/admin/padres` se mantiene intacta.

## Deuda técnica

- **Export CSV (US5)**: queda como P3. No se implementó en esta ventana; la UI muestra el botón deshabilitado con tooltip "Próximamente".

## Instrucciones de despliegue

- Ejecutar migración aditiva: `npx prisma migrate deploy`
- Correr seed idempotente para crear parámetros: `npx prisma db seed` (respeta valores custom por `update: {}`).
- No requiere cambios de variables de entorno.
