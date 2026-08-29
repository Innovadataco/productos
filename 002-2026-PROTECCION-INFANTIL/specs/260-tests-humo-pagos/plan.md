# Implementation Plan: SPEC-260 — Tests de humo de las 4 pantallas de Pagos

**Branch**: `work/002-PI-rescate-pagos` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Añadir 4 tests de humo (uno por pantalla de Pagos) que sepan lo mismo que un usuario: siembran datos, abren la pantalla, verifican que se ve algo real. Cero lógica de producto en este SPEC; solo cobertura. Cierra el patrón que dejó pasar 7 defectos en I-117..I-127.

## Technical Context

**Language/Version**: TypeScript 5
**Primary Dependencies**: Vitest + jsdom + `@testing-library/react` + Prisma test client
**Storage**: PostgreSQL 16 test (misma DB de integración)
**Testing**: la SPEC ES tests.
**Target Platform**: Node + jsdom
**Project Type**: web-service
**Performance Goals**: los 4 tests suman < 60 s en CI (siguiendo el patrón de integración existente).
**Constraints**: Cero mock del DAL; datos reales sembrados en `beforeAll`.
**Scale/Scope**: 4 archivos `.test.tsx` nuevos.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| §5.1 Testing | ✅ | Estrategia estándar del proyecto. |
| Candado motor IA | ✅ | No aplica. |

## Project Structure

```text
specs/260-tests-humo-pagos/
├── spec.md
├── plan.md
├── research.md   # patrón para importar y renderizar Server Components async
└── tasks.md

src/app/dashboard/admin/pagos/planes/page.test.tsx       # renderiza PlanesAdminCRUD con planes sembrados
src/app/dashboard/admin/pagos/sin-suscripcion/page.test.tsx
src/app/dashboard/admin/pagos/pendientes/page.test.tsx
src/app/dashboard/admin/pagos/bonos/page.test.tsx
```

**Structure Decision**: Option 1. Cada test vive junto a su `page.tsx`.

## Decisiones técnicas (para auditoría de ZEUS)

### Decisión 1 — Server Components se ejecutan como funciones async
Se importa `PendientesPage` (por ej.) y se hace `const jsx = await PendientesPage({ searchParams: Promise.resolve({}) })`; luego se pasa a `render(jsx)` de Testing Library. Es el patrón Next.js 15+/16 estándar y NO requiere mock.

### Decisión 2 — Datos sembrados con utilidades existentes
Se reutiliza `resetDatabase` y helpers de seed que ya usan otros tests de integración del proyecto (SPEC-090, SPEC-201, etc.). Cero mock del DAL.

### Decisión 3 — Se testea CONTENIDO, no status
El assert es `expect(screen.getByText("plan de prueba")).toBeInTheDocument()`, no `expect(res.status).toBe(200)`. Ese es el corazón de la lección de I-117..I-127: probar que la pantalla muestra algo.

## Complexity Tracking

Ninguna violación.
