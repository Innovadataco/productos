# Implementation Plan: Spec 082 — Fusión Playground + Modelos (y corrección I-05)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/082-fusion-playground-modelos/spec.md`

## Summary

Fusión de UI en `/dashboard/admin/ia`: eliminar el tab "Modelos" del arreglo `TABS` y renderizar `<IaModelSelector />` encima de `<IaPlayground />` dentro del tab "Playground". Corrección I-05: `IaModelSelector.fetchParams()` deja de usar la lista paginada (default 25) y pasa a pedir cada parámetro por clave (`GET /api/config/parametros/{clave}`, ya existente). Sin cambios de backend ni de la semántica de guardado (PATCH intacto).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Next.js 16 (App Router)
**Primary Dependencies**: componentes UI propios (`GlassCard`, `Button`, `Input`, `Select`, `Badge`); endpoints existentes `/api/config/parametros/[clave]`, `/api/admin/ia/modelos`, `/api/admin/ia/ollama/probar`
**Storage**: `ParametroSistema` en PostgreSQL (sin cambios de esquema)
**Testing**: Vitest + Testing Library (tests de componente nuevos para la fusión e I-05); gate `lint`/`test`/`build`/`tsc`
**Target Platform**: web admin (`:5005`)
**Constraints**:
- Fusión, no rediseño: no alterar el árbol interno de `IaModelSelector` ni `IaPlayground`.
- No tocar backend ni la semántica del PATCH.
- TypeScript estricto: prohibido `any`.

## Constitution Check

*GATE: verificado contra `.specify/memory/constitution.md` y AGENTS.md.*

| Regla | Evaluación |
|-------|------------|
| Spec Kit obligatorio | Cumplido (spec + plan antes de implementar). |
| Restricciones de producto (solo texto, IA local, etc.) | Sin impacto: UI de administración del motor IA local. |
| Secrets por variables de entorno | Sin impacto; `system.ollama_base_url` no es secreto y el endpoint ya sanitiza. |
| Convención de tests para endpoints | No aplica (no hay endpoints nuevos); se añaden tests de componente según patrón Vitest del repo. |

Sin violaciones que justificar.

## Diseño (Phase 1)

### Cambio 1 — `src/app/dashboard/admin/ia/page.tsx` (fusión de tabs)

- `TABS`: eliminar `{ key: "modelos", label: "Modelos" }` → quedan `documentacion`, `playground`, `eval`, `configuracion`.
- Render: reemplazar las dos líneas
  ```tsx
  {activeTab === "playground" && <IaPlayground initialOverrides={initialOverrides} />}
  {activeTab === "modelos" && <IaModelSelector />}
  ```
  por:
  ```tsx
  {activeTab === "playground" && (
      <>
          <IaModelSelector />
          <IaPlayground initialOverrides={initialOverrides} />
      </>
  )}
  ```
- El fallback de `activeTab` (`TABS.some(...)` else `"documentacion"`) ya cubre URLs viejas con `?tab=modelos` (FR-006); no se añade redirect extra.
- Se evalúa un separador visual mínimo (p. ej. `<hr>` o heading "Configuración de modelos") entre ambos bloques. Decisión: **no añadir nada** — ambos componentes ya traen sus propias `GlassCard` con títulos; cualquier añadido sería rediseño. Los dos bloques quedan apilados con el `space-y-6` propio de `IaModelSelector` + un wrapper `space-y-6`.

### Cambio 2 — `src/components/modules/ia/IaModelSelector.tsx` (I-05)

Reescribir `fetchParams()` para pedir las dos claves por separado:

```ts
async function fetchParam(clave: string): Promise<string> {
    const res = await fetch(`/api/config/parametros/${encodeURIComponent(clave)}`, { credentials: "include" });
    if (!res.ok) return ""; // 404 u otro error → campo vacío (tolerante, igual que hoy)
    const data = await res.json();
    return data.valor ?? "";
}

async function fetchParams() {
    try {
        const [modelo, url] = await Promise.all([
            fetchParam("reportes.classification_model"),
            fetchParam("system.ollama_base_url"),
        ]);
        setParams([
            { clave: "reportes.classification_model", valor: modelo },
            { clave: "system.ollama_base_url", valor: url },
        ]);
        setSelectedModel(modelo);
        setOllamaUrl(url);
    } catch {
        setMessage({ type: "error", text: "Error cargando parámetros" });
    }
}
```

Notas:
- Se conserva el estado `params` y la actualización optimista de `saveParam` (FR-007): al guardar, `setParams` mapea sobre las mismas dos entradas.
- El GET por clave devuelve `{ ...param, valor, historial }`; se usa solo `valor`.
- No se toca `fetchModels`, `testConnection`, `saveParam` ni el JSX.

### Alternativas consideradas

| Alternativa | Decisión | Motivo |
|-------------|----------|--------|
| GET por clave (una petición por parámetro) | **Elegida** | Es el arreglo preferido del brief; inmune a paginación y al orden por categoría; endpoint ya existente. |
| Pasar `pageSize=100` a la lista | Rechazada | Funciona hoy (103 params > 100 quedaría cerca del límite) pero sigue acoplada al tamaño total y al orden; el brief la descarta explícitamente. |
| Endpoint nuevo multi-clave | Rechazada | Backend fuera de alcance; innecesario. |
| Redirect `?tab=modelos` → `?tab=playground` | Rechazada | El fallback a "documentacion" ya evita roturas; no hay enlaces internos a `tab=modelos` (verificado con grep). |

### Tests (patrón Vitest + Testing Library del repo)

Nuevo `src/components/modules/ia/IaModelSelector.test.tsx`:
1. I-05: mock de `fetch` respondiendo por clave → el input URL se rellena con `http://localhost:11434` y el botón "Guardar URL" queda habilitado (regresión del bug: la lista paginada ya no se usa; se verifica que `fetch` se llamó con `/api/config/parametros/system.ollama_base_url`).
2. Modelo activo cargado por clave → `Select` muestra el valor persistido.
3. 404 en una clave → campo vacío sin error visible.

No se añaden tests de `page.tsx` (server component con `searchParams`; la composición se valida en la prueba manual del quickstart y el render de ambos componentes queda cubierto por sus propios tests).

## Project Structure

### Documentation (this feature)

```text
specs/082-fusion-playground-modelos/
├── spec.md
├── plan.md              # Este archivo
├── research.md          # Verificación de código (I-05, TABS, endpoints)
├── quickstart.md        # Prueba manual del tab fusionado
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (tras aprobación)
```

(Sin `data-model.md` ni `contracts/`: sin cambios de esquema ni de API.)

### Source Code (repository root)

```text
src/app/dashboard/admin/ia/page.tsx                 # TABS + composición del tab playground
src/components/modules/ia/IaModelSelector.tsx       # fetchParams por clave (I-05)
src/components/modules/ia/IaModelSelector.test.tsx  # NUEVO: regresión I-05 + carga por clave
```

**Structure Decision**: dos archivos modificados + un test nuevo. `IaPlayground.tsx` intacto.

## Plan de ejecución (tras aprobación de ZEUS)

1. Editar `page.tsx` (TABS + composición).
2. Editar `IaModelSelector.tsx` (`fetchParams` por clave).
3. Añadir `IaModelSelector.test.tsx` y correrlo.
4. Prueba manual del quickstart en `:5005` (URL cargada, guardar persiste, sandbox intacto, "Probar con este modelo" navega con override).
5. Gate: `npm run lint && npm run test && npm run build && npx tsc --noEmit` + `./scripts/dev-restart.sh`.
6. Docs: `cierre.md`, sección Implementación en `spec.md`, índice `specs/README.md`.
7. Commit: `feat(admin-ia): fusiona Playground+Modelos y corrige carga de config (spec 082, I-05)`.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Romper alguna acción al reubicar | FR-003 como checklist manual; no se toca el interior de los componentes. |
| Tests existentes que montan `IaModelSelector` y mockean la lista paginada | Verificado: no existe test previo de este componente (se crea el primero). |
| Shape del GET por clave distinto al esperado | Verificado en `src/app/api/config/parametros/[clave]/route.ts`: devuelve `{ ...param, valor, historial }`. |

## Complexity Tracking

Sin violaciones de constitución que justificar.
