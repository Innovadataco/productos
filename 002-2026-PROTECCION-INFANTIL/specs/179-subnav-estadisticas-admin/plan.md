# Implementation Plan: SPEC-179 — Sub-nav del área Estadísticas del admin (I-59)

**Branch**: `work/002-pi-nocturno-20260817` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

---

## Estado actual (verificado en fuente)

- `DashboardSubNav` fue eliminado en SPEC-171; sus 2 hrefs (operación/clasificación) quedaron cubiertos por tabs internos `?tab=`.
- `scripts/arch/lib/nav-fuentes.ts:149-152`: `subnavsFijos()` documenta que DashboardSubNav desapareció; hoy solo parsea `OperadoresSubNav.tabs` (patrón: array `tabs` con `href:` literales, extraídos por regex para la aserción B).
- Páginas del área: `operacion/page.tsx` (Suspense + OperacionTableroClient con tabs internos), `clasificacion/page.tsx` (redirect), `motor/page.tsx` (server, guard `verificarAccesoPagina("estadisticas")`), `page.tsx` (index → redirect operacion).

## Cambios

### 1. Componente `EstadisticasSubNav.tsx` (nuevo)

En `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx`, patrón `OperadoresSubNav`:

```tsx
const tabs = [
    { href: "/dashboard/admin/estadisticas/operacion", label: "Operación" },
    { href: "/dashboard/admin/estadisticas/operacion?tab=clasificacion", label: "Clasificación" },
    { href: "/dashboard/admin/estadisticas/motor", label: "Motor" },
];
```

- Client component: `usePathname` + `useSearchParams` para marcar el activo (Operación activo si pathname es operacion y `tab` ≠ "clasificacion"; Clasificación activo si `tab === "clasificacion"`; Motor por pathname).
- Filtrado por `esDestinoPermitidoPorRol` como los demás sub-navs (si el patrón lo hace; verificar OperadoresSubNav).

### 2. Montarlo en las páginas

- `operacion/page.tsx`: `<EstadisticasSubNav />` encima del tablero.
- `motor/page.tsx`: mismo sub-nav arriba.
- (La index ya redirige; la clasificación redirige.)

### 3. Aserción B (`scripts/arch/lib/nav-fuentes.ts`)

- Añadir `EstadisticasSubNav.tabs` a `subnavsFijos()` (mismo mecanismo de parseo). Verificar que el href con `?tab=` pase la aserción; si el evaluador exige pathname limpio, documentar y ajustar el parseo a `href.split("?")[0]` para la evaluación (el href completo queda en el componente).

### 4. Tests

- Unit `EstadisticasSubNav.test.tsx`: 3 destinos, activo por pathname/tab, hrefs exactos. Registrar en `vitest.unit.includes.ts`.

### 5. Arquitectura

- Regenerar `docs/architecture/` (03-pantallas principalmente) + `arch:check` verde.

## Verificación

Gate local completo + CI del PR #55 tras el push.
