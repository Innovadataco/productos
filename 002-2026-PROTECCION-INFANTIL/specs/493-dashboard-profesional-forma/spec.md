# SPEC-493 · Afinado de forma: dashboard-público + profesional (concretos)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: auditoría de FORMA de Diseño (2/3 dashboard-público, 3/3 profesional). Solo los CONCRETOS; los `[revisar-fresco]` esperan pase fresco.

## El arreglo
1. **PublicDashboard.tsx** (:62,65,68): skeleton `bg-slate-200 dark:bg-slate-700` → **`bg-tinta/5`** (token de skeleton); radio suelto `rounded-lg` (:62) → `rounded-[var(--radio-card)]`.
2. **MapaUbicaciones.tsx** — 5 crudos de CHROME (NO la paleta de pins de SPEC-370, que es data-viz por hex): `:309/:343/:349` `text-slate-600` → `.text-muted`; `:358` caja de leyenda `border-slate-200 bg-white/90 dark:…` → `border-tinta/10 bg-papel/90`; `:382` aviso «sin ubicación» `bg-amber-50 text-amber-700 dark:…` → `bg-ambar/10 text-estado-ambar`.
3. **Etiquetas 11px**: `BarChart.tsx:38,59` y `PanelProfesional.tsx:197` `text-[10px]` → `text-[11px]` (la escala de etiqueta del sistema; no hay token dedicado, `text-[11px]` es el valor ya usado en profesional).

## Candado — `src/components/modules/dashboard-profesional-forma.candado.test.ts`
- PublicDashboard skeleton sin slate; MapaUbicaciones chrome sin slate/amber (pins data-viz exenta, es hex); 0 `text-[10px]` en BarChart/PanelProfesional. Muere por mutación.

## Impacto en arquitectura:
- Cierra la forma concreta de dashboard-público + profesional. La paleta de pins (data-viz) queda documentada como exenta. Sin conducta.

## Lo que NO cambia / fuera de alcance
- La paleta de pins de `MapaUbicaciones` (data-viz, SPEC-370). Los `[revisar-fresco]` de Diseño (KPIs `text-2xl`, densidad profesional, estados EmptyState/ErrorState) → pase fresco.

## Referencias
SPEC-370 (paleta de pins). Rama del lote desde `origin/main 94c0e8c8c`.
