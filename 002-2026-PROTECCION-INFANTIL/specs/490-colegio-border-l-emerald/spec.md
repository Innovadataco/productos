# SPEC-490 · Los 2 border-l-emerald del colegio + refuerzo del patrón direccional

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: cert por código de Diseño (colegio). Los 2 crudos que SPEC-482 perdió por el infijo direccional `-l-`.

## El arreglo
`ColegioEstadisticasPageClient.tsx:189,205` — `border-l-4 border-l-emerald-500` (acento de tarjeta, no data-viz; el número ya es `text-estado-pino`) → **`border-l-pino`**.

**Causa raíz (gap del patrón):** el candado del colegio (`colegio-sin-crudo`) usaba `(text|bg|border|…)-<color>-N` con `\b`, que **no captura variantes direccionales** `border-[ltrbxy]-<color>-N` → por eso 482 pasó dejando estos 2. Se reforzó su regex con el infijo direccional opcional `(?:-[ltrbxy])?`. (Los candados de barrido admin/ia/chrome ya usan la forma con guion inicial `-(familia)-N`, que sí captura direccionales — no necesitan cambio.)

## Candado — `src/lib/rediseno/colegio-sin-crudo.candado.test.ts` (reforzado)
- 0 crudo (incl. direccionales) en colegio. Muere por mutación (poner `border-t-slate-200` → rojo).

## Impacto en arquitectura:
- Cierra el colegio de forma (0 crudo real, direccionales incluidas). Endurece el patrón de candado reusable contra el gap direccional.

## Referencias
SPEC-482 (barrido colegio; perdió estos 2). Rama del lote desde `origin/main 94c0e8c8c`.
