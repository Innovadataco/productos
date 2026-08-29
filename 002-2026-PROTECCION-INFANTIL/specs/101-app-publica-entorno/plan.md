# Implementation Plan: Spec 101 — App pública y entorno (I-23 / I-24 / A-2)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

> Backfill documental (cierre cola 002-PI-014): plan reconstruido a partir del spec.md,
> el cierre.md y el commit `4e49b1a8`. Documenta lo hecho.

## Summary

Tres defectos de la app pública y del entorno IA: el crash de `/dashboard-publico` por un
campo que la API ya no devuelve (y la presencia ilegal de nivel de riesgo/score en la UI
pública, D-10/§1.3/§1.5), el sondeo de Ollama tomando la URL del cliente en vez de la fuente
única configurada (origen del fantasma "11433"), y un arco SVG mal formado en la nav admin.

## Diseño

1. **I-23 (🔴 dashboard público)**: causa raíz — `PublicDashboard.tsx` hacía
   `data.porNivelRiesgo.map(...)` y la API ya no devuelve ese campo (D-10) → `undefined.map`.
   Además mostraba KPI "Score promedio" y tarjeta "Nivel de riesgo" (viola §1.3/§1.5).
   Cambios: eliminados del componente (import de `formatNivel`/`RIESGO_COLORS`, campos del
   tipo, KPI y tarjeta; grids reajustados; render defensivo ante campos ausentes).
   `src/lib/labels.ts`: borrados `RIESGO_LABELS`/`RIESGO_COLORS`/`formatNivel` (solo los
   usaba `RiskBadge.tsx`, código muerto verificado con grep en todo `src/` → eliminado).
   La API no se tocó (sigue devolviendo `scorePromedio`; registrado como deuda).
2. **I-24 (sondeo Ollama)**: causa raíz — `POST /api/admin/ia/ollama/probar` sondeaba la URL
   que mandaba el CLIENTE en el body (un valor viejo tecleado en `IaModelSelector`); el
   "11433" no existía en código/env/BD. Reescrito: UNA fuente = `getOllamaBaseUrl()`
   (param `system.ollama_base_url` → env → default 11434), validada con `isLocalOllamaUrl`;
   cerebro inalcanzable → 503 controlado `{ ok:false, error:{ message:"Ollama
   inalcanzable" } }` (nuevo `ERROR_CODES.SERVICE_UNAVAILABLE`), no excepción no
   controlada. Efecto deliberado: "Probar conexión" sondea la URL guardada.
3. **A-2 (SVG roto)**: `AdminNav.tsx` (`InboxIcon`) — arco con 2 de 7 parámetros
   (`h15a2.25-2.25V…`) → corregido a `a2.25 2.25 0 002.25-2.25`. Validador arc-aware sobre
   todo el repo: era el único `d` mal formado.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Borrar algo que otra pantalla use | grep exhaustivo de `formatNivel`/`RIESGO_*`/`RiskBadge` antes de eliminar |
| Sondeo cambie UX de "probar antes de guardar" | Decisión deliberada por la unificación; documentada en el cierre |
| Excepción de red no controlada | catch con AppError 503 + test con fetch rechazado |

## Pruebas

5 tests nuevos: `PublicDashboard.test.tsx` (3: renderiza sin nivel ni crash, defensivo ante
campos ausentes, error controlado), `ollama/probar/route.test.ts` (2: fuente única; 503
controlado con fetch rechazado). Gate: lint + test + tsc + build (911/911).
