# Research — Spec 082 (fusión Playground + Modelos, I-05)

**Fecha**: 2026-07-22 · **Autor**: ODIN

## Verificación del estado actual (en código)

1. **Tabs** (`src/app/dashboard/admin/ia/page.tsx:13-19`): `documentacion`, `playground`,
   `modelos`, `eval`, `configuracion`. `modelos` renderiza `<IaModelSelector />` (línea 83);
   `playground` renderiza `<IaPlayground initialOverrides />` (línea 82). Fallback de tab
   desconocido → `documentacion` (línea 44): cubre URLs viejas con `?tab=modelos`.
2. **I-05 confirmado** (`src/components/modules/ia/IaModelSelector.tsx:51-64`):
   `fetchParams()` llama `GET /api/config/parametros` sin `pageSize` →
   `DEFAULT_PAGE_SIZE = 25` (`src/lib/pagination.ts:9`), ordenado por `categoria`.
   Con ~103 parámetros, `system.ollama_base_url` queda fuera de la página 1 →
   `ollamaUrl = ""` → botones disabled (`!ollamaUrl.trim()`, líneas 156 y 159).
3. **Endpoint por clave ya existe** (`src/app/api/config/parametros/[clave]/route.ts`):
   `GET` con `verifyAuth(ADMIN)`, 404 si no existe, respuesta plana
   `{ ...param, valor, historial }` con `valor: null` si `esSecreto`.
   Las dos claves objetivo no son secretas.
4. **Referencias a `tab=modelos`**: ninguna fuera de `page.tsx`
   (`grep` en `src/**/*.tsx,ts`). El botón "Probar con este modelo"
   (`IaModelSelector.tsx:205`) ya navega a `?tab=playground&modelo_clasificacion=...`
   → compatible con la fusión sin cambios.
5. **Tests previos**: no existe `IaModelSelector.test.tsx`; hay tests de endpoints
   de parametros (`src/app/api/config/parametros/route.test.ts`) que no se tocan.
6. **Guardado**: `saveParam` hace PATCH a `/api/config/parametros/{clave}` con
   actualización optimista de `params` — se conserva intacto (FR-005/FR-007).

## Decisión

- Fusión: borrar la entrada `modelos` de `TABS` y componer
  `<IaModelSelector />` + `<IaPlayground />` en el tab `playground`.
- I-05: dos GET por clave en paralelo (`Promise.all`), tolerante a 404.
- Sin separador visual nuevo: ambos componentes ya traen `GlassCard` con títulos.

## Riesgo residual

Ninguno identificado más allá de los cubiertos en `plan.md` (regresión funcional
→ checklist manual FR-003).
