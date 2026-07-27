# Feature Specification: App pública y entorno (I-23 / I-24 / A-2)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Status**: DESARROLLO

## Contexto

Cola nocturna 002-PI-014, Fase 2. Defectos de la app pública y del entorno IA.

## Requisitos

- **FR-I23** (🔴): `/dashboard-publico` crashea — `PublicDashboard.tsx` aún usa
  `formatNivel`/`RIESGO_COLORS` (nivel de riesgo) y la API ya no devuelve ese dato (D-10).
  Quitar TODO rastro de nivel de riesgo/score de esa pantalla (mostrarlo viola §1.3/§1.5
  de la constitución, familia I-13). La pantalla muestra solo estadísticas agregadas y
  lenguaje descriptivo.
- **FR-I24**: el sondeo IA-OLLAMA-PROBAR pega al puerto 11433 (el correcto es 11434; env y
  parámetros ya dicen 11434). Rastrear de dónde sale el 11433 y unificar a UNA fuente:
  `OLLAMA_BASE_URL`. Además, el sondeo DEBE degradar con gracia cuando el cerebro es
  inalcanzable (respuesta controlada, NO excepción no controlada).
- **FR-A2**: ícono con ruta SVG rota (consola: "<path> d: Expected number") → corregir el path.

## Success Criteria

- **SC-001**: `/dashboard-publico` carga sin errores de consola ni nivel de riesgo.
- **SC-002**: El sondeo usa una sola fuente de URL de Ollama y responde controlado si el
  cerebro está caído (test que lo prueba).
- **SC-003**: Sin warnings de SVG en consola.
- **SC-004**: Gate verde (lint + test + tsc + build).
