# Cierre — Spec 101: App pública y entorno (I-23 / I-24 / A-2)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding`

## Lo hecho

- **I-23 (🔴)**: `/dashboard-publico` crasheaba por `data.porNivelRiesgo.map(...)` — la API
  ya no devuelve ese campo (D-10). Eliminados de la pantalla pública: KPI "Score promedio",
  tarjeta "Nivel de riesgo", `formatNivel`/`RIESGO_COLORS` (y `RiskBadge.tsx`, código muerto
  verificado con grep en todo `src/`). Render defensivo ante campos ausentes. La pantalla
  queda solo con estadísticas agregadas y lenguaje descriptivo (§1.3/§1.5).
- **I-24**: el `11433` no existía en código/env/BD: el sondeo `POST /api/admin/ia/ollama/probar`
  usaba la URL que mandaba el CLIENTE en el body (un valor viejo tecleado en `IaModelSelector`).
  Reescrito: una sola fuente = `getOllamaBaseUrl()` (param `system.ollama_base_url` → env →
  default 11434), validada con `isLocalOllamaUrl`. Cerebro inalcanzable → **503 controlado**
  `{ ok:false, error:{ message:"Ollama inalcanzable" } }` (nuevo
  `ERROR_CODES.SERVICE_UNAVAILABLE`), no excepción no controlada. Efecto deliberado: "Probar
  conexión" ahora sondea la URL guardada, no la tecleada sin guardar.
- **A-2**: `AdminNav.tsx` (`InboxIcon`) — arco SVG con 2 de 7 parámetros (`h15a2.25-2.25V…`)
  → corregido a `a2.25 2.25 0 002.25-2.25`. Validador arc-aware sobre todo el repo: era el
  único `d` mal formado.

## Gate

tsc ✅ · lint ✅ (0 errores, 1 warning preexistente) · **911/911 tests** ✅ (5 nuevos:
PublicDashboard ×3, ollama/probar ×2) · build ✅.

## Deuda registrada

- La API pública `/api/estadisticas-publicas` sigue exponiendo `scorePromedio` aunque ya no
  se muestra — decidir si sale del contrato (D-10).
- `ollamaProbarBodySchema` quedó huérfano (sigue exportado/testeado; candidato a retiro).
