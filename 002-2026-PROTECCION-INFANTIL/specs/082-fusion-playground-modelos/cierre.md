# Cierre — Spec 082: Fusión Playground + Modelos (I-05)

**Fecha**: 2026-07-22
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/082-fusion-playground-modelos/`
**Incidencia**: I-05
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS para marcar CERRADA

## Resumen por User Story

| US | Descripción | Estado |
|----|-------------|--------|
| US1 (P1) | Tab unificado Playground (config arriba, sandbox abajo) | Implementado y verificado |
| US2 (P1) | Conservación del 100% de la funcionalidad | Verificado (recorrido FR-003) |
| US3 (P1) | Corrección I-05: URL de Ollama carga y persiste | Implementado + test de regresión |

## Cambios realizados

1. `src/app/dashboard/admin/ia/page.tsx`:
   - `TABS` sin "modelos" → quedan Documentación, Playground, Eval, Configuración.
   - El tab `playground` compone `<IaModelSelector />` + `<IaPlayground initialOverrides />` en un wrapper `space-y-6`. URLs viejas `?tab=modelos` caen al fallback `documentacion` sin romperse.
2. `src/components/modules/ia/IaModelSelector.tsx` (I-05):
   - `fetchParams()` ya no usa la lista paginada (`DEFAULT_PAGE_SIZE=25`); ahora pide cada parámetro por clave con `GET /api/config/parametros/{clave}` en paralelo (`reportes.classification_model`, `system.ollama_base_url`), tolerante a 404.
   - `saveParam` (PATCH), `fetchModels`, `testConnection` y todo el JSX intactos.
3. `src/components/modules/ia/IaModelSelector.test.tsx` (NUEVO, 3 tests):
   - I-05: URL cargada por clave + "Guardar URL" habilitado + se verifica que no se llama la lista paginada.
   - Modelo activo cargado por clave; badges de embeddings presentes.
   - 404 de una clave → campo vacío, botón disabled, sin mensaje de error.

## Validación

- Tests del componente: 3/3.
- Gate de calidad:
  - `npm run lint`: 0 errores (1 warning heredado `react-hooks/exhaustive-deps` en `IaModelSelector.tsx`, preexistente).
  - `npx tsc --noEmit`: OK.
  - `npm run test`: **719/719 tests pasan (120 archivos)** — 716 previos + 3 nuevos.
  - Nota: la suite completa mostraba 1 fallo intermitente por timeout (>5 s) en `validar-anonimizacion/route.test.ts` (llama a Ollama real; en aislamiento pasa 4/4 en ~2 s). Se corrigió con `{ timeout: 20000 }` en el `describe` de ese archivo — cambio de configuración de test, sin tocar lógica.
  - `rm -rf .next && npm run build`: OK.
  - `./scripts/dev-restart.sh`: app en `:5005` con `-H 0.0.0.0`, healthcheck `{"status":"ok","workerAlive":true,"dbOk":true}`, un solo worker.
- Prueba manual en `:5005` (quickstart §A/§B, verificación por API):
  - Login ADMIN (`soporte@innovadataco.com`) OK.
  - `GET /api/config/parametros/system.ollama_base_url` → `valor: "http://localhost:11434"` (I-05: el dato llega por clave).
  - `PATCH` de la URL → 200; re-lectura devuelve el mismo valor (semántica de guardado intacta).
  - `GET /api/config/parametros/reportes.classification_model` → `ornith:9b` (modelo activo carga por clave).
  - `GET /dashboard/admin/ia?tab=playground`: la navegación expone solo `documentacion`, `playground`, `eval`, `configuracion` (0 ocurrencias de `tab=modelos`).
  - `GET /dashboard/admin/ia?tab=modelos`: cae en el fallback sin romperse (la única ocurrencia de `tab=modelos` es la URL pedida en el payload RSC).

## Deuda técnica registrada

- **Warning heredado** `react-hooks/exhaustive-deps` en `IaModelSelector.tsx` (preexistente; resolver con `useCallback` en una spec de saneamiento UI).

## Commit

- `feat(admin-ia): fusiona Playground+Modelos y corrige carga de config (spec 082, I-05)`
