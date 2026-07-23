# Data Model — 082-fusion-playground-modelos (I-05)

> **Sin cambios de schema ni de datos.** Fusión de UI + corrección de carga de configuración.

## Entidades involucradas (existentes)

- **`ParametroSistema`** (lectura por clave): `system.ollama_base_url` y `reportes.classification_model`.
  - I-05: la lista paginada (`DEFAULT_PAGE_SIZE = 25`, orden por categoría) dejaba `system.ollama_base_url` fuera de la página 1 (~103 parámetros) → campo vacío y botón disabled.
  - Fix: lectura por clave con `GET /api/config/parametros/[clave]` (respuesta `{ ...param, valor, historial }`, `valor: null` si `esSecreto`).

## Estructura de UI (sin modelo de datos)

- Tabs del Centro de Control IA: `documentacion`, `playground`, `eval`, `configuracion` (el tab `modelos` se elimina).
- El tab `playground` compone `<IaModelSelector />` (configuración) + `<IaPlayground />` (sandbox).
