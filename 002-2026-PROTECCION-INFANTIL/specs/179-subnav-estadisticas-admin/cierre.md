# Cierre: SPEC-179 — Sub-nav del área Estadísticas del admin (I-59)

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-nocturno-20260817` (parche sobre PR #55) · **Compuerta §4**: APROBADA por ZEUS.

## Qué se implementó

1. **`EstadisticasSubNav.tsx`** (nuevo, patrón OperadoresSubNav): 3 destinos con hrefs literales — **Operación** (`/dashboard/admin/estadisticas/operacion`) · **Clasificación** (`?tab=clasificacion`) · **Motor** (`/dashboard/admin/estadisticas/motor`). Activo por `usePathname` + `useSearchParams`; filtrado por `esDestinoPermitidoPorRol`; `aria-current` para accesibilidad; tokens del proyecto (cero color crudo).
2. Montado en `operacion/page.tsx` y `motor/page.tsx` (con Suspense por `useSearchParams`).
3. **`subnavsFijos()`** (nav-fuentes.ts): registrado `EstadisticasSubNav.tabs`; el parseo evalúa `split("?")[0]` (la puerta evalúa pathname — decisión de compuerta).
4. **Hallazgo corregido en el camino (flake)**: `OperacionTableroClient.test.tsx` fallaba intermitente en corridas completas — "Cerebro IA" aparece también en `WidgetErrores` cuando el incidente del fixture se renderiza antes de la aserción (timing). La aserción pasó a `getAllByText(…).length >= 1` (la intención es presencia, no unicidad). Verificado: 2 corridas completas verdes consecutivas.

## Evidencia

- `EstadisticasSubNav.test.tsx` 3/3 (hrefs exactos, activo por pathname/tab).
- `arch:check` ✅ — aserción B evalúa 97 hrefs (los 3 nuevos incluidos, `?tab=` bien manejado).
- Gate: tsc ✅ · eslint --no-cache ✅ · tokens ✅ · unit 846/846 ×2 ✅ · journeys 47/47 ✅ · build ✅ · arranque ✅ (home 200, operacion/motor 307 sin sesión).
- Cero cambios de permisos/catálogo/proxy/modelo/endpoints.
