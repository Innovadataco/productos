# Implementation Plan: SPEC-256 — Pantallas Pagos leen del DAL

**Branch**: `work/002-PI-rescate-pagos` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Reemplazar `fetch("/api/admin/pagos/...")` en dos Server Components por lectura directa del DAL (`PagosAdminManualRepository`, `PagosRepository`). Eliminar el `catch { return null }` mudo — el error se muestra como `Alerta`. Estados vacío y roto quedan diferenciados. Cero cambio de API, cero migración.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 App Router
**Primary Dependencies**: Prisma 5.22 (vía DAL), Vitest para tests
**Storage**: PostgreSQL 16
**Testing**: renderizar la Server Component vía import + smoke check con datos sembrados (SPEC-260 lo formaliza)
**Target Platform**: server-side Node en render de página
**Project Type**: web-service
**Performance Goals**: menor latencia (elimina el ida-y-vuelta HTTP dentro del mismo proceso)
**Constraints**: NO tocar los 4 archivos de cliente con patrón similar; NO tocar API REST; frontera DAL Q-3.
**Scale/Scope**: 2 archivos `page.tsx` refactorizados; posiblemente 1-2 métodos aditivos al DAL si faltan.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| §4.5 Migraciones aditivas | ✅ | Ninguna. |
| Frontera DAL (Q-3) | ✅ | `src/app/**` NO importa `@/lib/prisma`. |
| Candado motor IA | ✅ | No aplica. |

## Project Structure

```text
specs/256-pagos-server-dal/
├── spec.md
├── plan.md
├── research.md    # cuáles métodos DAL ya existen, cuáles agregar
└── tasks.md

src/app/dashboard/admin/pagos/sin-suscripcion/page.tsx  # sin fetch, con DAL
src/app/dashboard/admin/pagos/pendientes/page.tsx       # sin fetch, con DAL

src/lib/dal/repositories/pagos-admin-manual-repository.ts  # métodos aditivos (si faltan)
src/lib/dal/services/pagos-admin-manual.ts                 # servicio (si aplica)
```

**Structure Decision**: Option 1 (monolito). Fase 0 confirma qué métodos DAL ya existen; se agregan solo los estrictamente necesarios.

## Decisiones técnicas (para auditoría de ZEUS)

### Decisión 1 — El error NO se traga
Cada bloque (`listado`, `catalogo` en sin-suscripcion; `pagos`, `solicitudes` en pendientes) se envuelve en `try/catch` propio. Si el DAL lanza, se captura el `error` y se pinta `Alerta tono="error"` en lugar del bloque tabular. Estados independientes por bloque: pagos puede fallar sin romper solicitudes.

### Decisión 2 — Si falta un método en el DAL, se agrega aquí
Si `PagosAdminManualRepository.listarSinSuscripcion` (u otro) no existe todavía, se agrega en Fase 1 dentro del scope de esta SPEC, siguiendo el patrón del repo existente. NO se importa `@/lib/prisma` desde `src/app`.

### Decisión 3 — API REST intacta
Los endpoints bajo `src/app/api/admin/pagos/**` (sin-suscripcion, pendientes, solicitudes-pendientes) NO se tocan. Si algún cliente externo o test los usa, siguen respondiendo igual. Es una decisión de mínimo riesgo: reparar la vista sin cambiar el contrato hacia afuera.

## Complexity Tracking

Ninguna violación.
