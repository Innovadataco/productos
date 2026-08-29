# Plan de implementación: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT (002-PI-088)

## Resumen

Feature de administración estratégica con dos frentes:
1. **Vista de usuarios PARENT**: nueva ruta `/dashboard/admin/usuarios` con sub-tabs por rol; el sub-tab "Padres" cierra I-37.
2. **Analítica de colegios**: nuevo sub-tab "Colegios" en `/dashboard/admin/estadisticas/operacion` con resumen de colegios y ficha detalle de 7 secciones + hallazgos automáticos configurables.

Todo es solo lectura + configuración de umbrales. Cero escritura en entidades de negocio. Motor `src/lib/ai/**` intocable.

## Contexto técnico

- **Framework**: Next.js 16.2.10 App Router, React 19 Server Components por defecto.
- **Lenguaje**: TypeScript 5 con `strict: true`.
- **ORM**: Prisma 5.22.0 sobre PostgreSQL 16.
- **Auth**: JWT manual (`jose` + `bcryptjs`) + cookie `httpOnly`.
- **UI**: Tailwind CSS 3.4, componentes en `src/components/ui/**` y `src/components/modules/**`.
- **Testing**: Vitest + jsdom + Testing Library.
- **Caché**: en memoria (Map) con TTL; sin Redis.

## Constitution Check

- ✅ Sin multimedia (solo texto + agregados numéricos).
- ✅ Presunción de inocencia (lenguaje estadístico, nunca veredictos).
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados (no es flujo de reporte).
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/194-analitica-colegios/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── endpoints.md
└── checklists/
    └── requirements.md
```

### Código
```text
src/app/dashboard/admin/usuarios/page.tsx
src/app/dashboard/admin/usuarios/UsuariosAdminClient.tsx
src/app/dashboard/admin/usuarios/[id]/page.tsx
src/app/dashboard/admin/usuarios/[id]/UsuarioDetalleClient.tsx
src/app/dashboard/admin/estadisticas/operacion/colegios/[colegioId]/page.tsx
src/app/dashboard/admin/estadisticas/operacion/colegios/[colegioId]/ColegioDetalleClient.tsx
src/app/api/admin/usuarios/route.ts
src/app/api/admin/usuarios/route.test.ts
src/app/api/admin/analytics/colegios/route.ts
src/app/api/admin/analytics/colegios/route.test.ts
src/app/api/admin/analytics/colegios/[id]/route.ts
src/app/api/admin/analytics/colegios/[id]/route.test.ts
src/lib/dal/repositories/analytics-colegio.ts
src/lib/analytics/cache.ts
src/lib/analytics/hallazgos-colegio.ts
src/lib/analytics/usuarios-query.ts
src/components/modules/admin/UsuariosSubNav.tsx
src/components/modules/admin/ColegiosAnalyticsTable.tsx
src/components/modules/admin/ColegioDetalleSecciones.tsx
prisma/migrations/20260821110000_spec_194_analytics_indexes/migration.sql
```

## Cambios de código

### 1. Permisos y navegación

- `src/lib/permisos-modulos.ts`: registrar módulos `usuarios_admin` y `analytics_colegios`, ambos solo para `ADMIN`.
- `src/lib/nav-items.ts`: añadir ítem "Usuarios" → `/dashboard/admin/usuarios` (módulo `usuarios_admin`). Mantener "Colegios" de gestión existente.
- `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx`: añadir tab `{ href: "/dashboard/admin/estadisticas/operacion?tab=colegios", label: "Colegios" }` y lógica de activo.

### 2. Backend — Vista de usuarios

- Crear `src/app/api/admin/usuarios/route.ts`:
  - Valida `verifyAuth("ADMIN")` + `assertModulo(req, "usuarios_admin")`.
  - Query params: `rol` (default PARENT), `page`, `pageSize`, `q`, `estado`, `desde`, `hasta`, `conReportes`, `colegioId`.
  - Usa `UsuarioRepository` para listar usuarios filtrados.
  - Para `rol=PARENT`, cuenta reportes enviados vía `ReporteRepository.contarPorUsuarios`.
  - Devuelve `{ items, pagination }`.
- Crear `src/lib/analytics/usuarios-query.ts` con helpers tipados `Prisma.UsuarioWhereInput`.

### 3. Frontend — Vista de usuarios

- `src/app/dashboard/admin/usuarios/page.tsx`: Server Component con `verificarAccesoPagina("usuarios_admin")`.
- `src/app/dashboard/admin/usuarios/UsuariosAdminClient.tsx`:
  - Sub-tabs por rol.
  - Tabla de padres con búsqueda, filtros y paginación.
  - Reutiliza patrones de `PadresPageClient`.
- `src/app/dashboard/admin/usuarios/[id]/page.tsx` y `UsuarioDetalleClient.tsx`: ficha con historial de reportes agregados.

### 4. Backend — Analytics de colegios

- Crear `src/lib/dal/repositories/analytics-colegio.ts` con métodos:
  - `resumenColegios(filtros)`
  - `detalleColegio(colegioId)`
  - `serieReportes(tenantId, dias)`
  - `topIdentificadores(tenantId, limite)`
  - `metricasComite(colegioId)`
  - `metricasAlertas(colegioId)`
  - `comparacionConMedia(colegioId)`
- Crear `src/lib/analytics/cache.ts`:
  - `getCache<T>(key)`, `setCache<T>(key, value, ttlMs)`.
  - TTL desde `analytics.colegios.cache_ttl_min`.
- Crear `src/lib/analytics/hallazgos-colegio.ts`:
  - Lee parámetros.
  - Genera bullets positivos/negativos.
  - Calcula semáforo.
- Endpoints:
  - `GET /api/admin/analytics/colegios` → resumen paginado/ordenado/filtrado.
  - `GET /api/admin/analytics/colegios/[id]` → detalle completo.

### 5. Frontend — Analytics de colegios

- Extender `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx` para renderizar `ColegiosAnalyticsTable` cuando `tab === "colegios"`.
- `ColegiosAnalyticsTable.tsx`: tabla ordenable con búsqueda y filtros.
- `ColegioDetalleClient.tsx`: renderiza las 7 secciones; usa componentes minimalistas de barras/series.

### 6. Configuración de umbrales

- Extender `src/components/modules/ConfigPanel.tsx` (o `src/app/dashboard/admin/configuracion/**`) con sección "Analítica → Colegios".
- Reutilizar parámetros existentes: crear/actualizar via API de config.

### 7. Migración aditiva

- `prisma/migrations/20260821110000_spec_194_analytics_indexes/migration.sql` con los índices definidos en `data-model.md`.
- Cero `DROP`.

### 8. Seed

- `prisma/seed.ts`: añadir los 5 parámetros nuevos en sección `monitoreoNuevos` con `update: {}` para no pisar valores custom (patrón SPEC-187).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Queries lentas con muchos datos | Índices aditivos + SQL agregado + caché con TTL |
| Exposición de PII | Revisión de selects; tests de contrato que validan ausencia de `texto` y `usuarioId` |
| Confusión de rutas de colegios | Labels distintivos: "Gestión de colegios" vs "Analítica de colegios" |
| Cache inconsistente tras cambios manuales en BD | TTL corto (5 min); documentado como trade-off |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Tests de integración para `/api/admin/usuarios`, `/api/admin/analytics/colegios` y `/api/admin/analytics/colegios/[id]`.
- No tocar `src/lib/ai/**`.
- Migración aditiva aplicable sin pérdida de datos.
