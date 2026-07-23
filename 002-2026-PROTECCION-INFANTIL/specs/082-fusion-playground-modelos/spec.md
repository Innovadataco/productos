# Spec 082 — Fusión de tabs "Playground" + "Modelos" en admin/ia (y corrección I-05)

**Status**: `CERRADA` (ACTA-VALIDACION aprobada por ZEUS 2026-07-23)
**Rama**: `feature/001-scaffolding`
**Fase del programa**: Mejoras UX admin / Corrección de incidencias
**Creado**: 2026-07-22
**Incidencia**: I-05

**Input**: "Unir los submódulos Playground y Modelos del Centro de Control IA en UNO solo, sin perder ninguna funcionalidad actual. Es una fusión de UI, no un rediseño. Además corregir I-05: IaModelSelector.fetchParams() pide /api/config/parametros sin pageSize; con 103 params y DEFAULT_PAGE_SIZE=25, system.ollama_base_url no llega → campo vacío → Guardar URL disabled."

## Contexto

En `/dashboard/admin/ia` (Centro de Control IA) existen 5 tabs: Documentación, Playground, Modelos, Eval, Configuración (`src/app/dashboard/admin/ia/page.tsx:13-19`). El tab "Modelos" renderiza `IaModelSelector` (config de URL de Ollama, probar conexión, modelo de clasificación activo, modelos de embedding) y el tab "Playground" renderiza `IaPlayground` (sandbox del pipeline). Se quiere un solo tab "Playground" con la configuración de modelos arriba y el sandbox debajo.

**I-05 (verificado en código, 2026-07-22)**:

- `IaModelSelector.fetchParams()` (`src/components/modules/ia/IaModelSelector.tsx:51-64`) llama `GET /api/config/parametros` sin `pageSize`.
- El endpoint aplica `DEFAULT_PAGE_SIZE = 25` (`src/lib/pagination.ts:9`); el sistema tiene ~103 parámetros, ordenados por categoría.
- `system.ollama_base_url` queda fuera de la primera página → `ollamaUrl` queda `""` → botón "Guardar URL" disabled (`disabled={saving || !ollamaUrl.trim()}`, línea 159) y "Probar conexión" también.
- El endpoint `GET /api/config/parametros/[clave]` ya existe y devuelve el parámetro plano (`{ ...param, valor, historial }`), sanitizando secretos.

Verificaciones adicionales: ningún otro archivo referencia `tab=modelos`; el botón "Probar con este modelo" ya navega a `?tab=playground&modelo_clasificacion=...`, compatible con la fusión.

## User Scenarios & Testing

### User Story 1 — Tab unificado Playground (Priority: P1)

**Como** ADMIN de la plataforma,
**quiero** ver la configuración de modelos (URL de Ollama, modelo activo, embeddings) y el sandbox del pipeline en un solo tab "Playground",
**para** ajustar y probar la configuración sin cambiar de pestaña.

**Why this priority**: es el objetivo central del brief; simplifica el flujo config → prueba.

**Independent Test**: en `:5005`, entrar a `/dashboard/admin/ia?tab=playground` como ADMIN: arriba aparecen las secciones de `IaModelSelector` (URL de Ollama, modelo de clasificación, embeddings) y debajo el sandbox de `IaPlayground` intacto. El tab "Modelos" ya no existe en la navegación.

**Acceptance Scenarios**:

1. **Given** un ADMIN autenticado, **When** abre `/dashboard/admin/ia` y elige el tab "Playground", **Then** la página muestra primero el bloque de configuración de modelos completo (URL de Ollama + probar conexión + guardar, selector de modelo activo + "Probar con este modelo" + "Guardar como activo", badges de embeddings) y debajo el playground actual.
2. **Given** la navegación de tabs, **When** se inspeccionan los tabs disponibles, **Then** son: Documentación, Playground, Eval, Configuración (sin "Modelos").
3. **Given** una URL antigua con `?tab=modelos`, **When** se abre, **Then** cae en el tab por defecto (o en "playground") sin romperse ni mostrar contenido vacío.

---

### User Story 2 — Conservación del 100% de la funcionalidad (Priority: P1)

**Como** ADMIN,
**quiero** que todas las acciones de ambos submódulos sigan funcionando tras la fusión,
**para** no perder capacidad operativa (probar conexión, guardar URL, cambiar modelo activo, overrides del sandbox, trazas y resultados).

**Why this priority**: el brief es explícito: fusión sin pérdida; una regresión funcional invalidaría el cambio.

**Independent Test**: recorrer cada acción de ambos componentes en el tab fusionado: probar conexión a Ollama, guardar URL, seleccionar y guardar modelo activo, "Probar con este modelo" (navega con override en querystring), ejecutar el sandbox con overrides y ver resultados/trazas.

**Acceptance Scenarios**:

1. **Given** el tab fusionado, **When** el ADMIN pulsa "Probar con este modelo", **Then** se navega a `?tab=playground&modelo_clasificacion=<modelo>` y el sandbox queda preconfigurado con ese override (mismo comportamiento actual).
2. **Given** el tab fusionado, **When** el ADMIN ejecuta una clasificación en el sandbox con overrides, **Then** resultados y trazas se muestran igual que antes de la fusión.
3. **Given** el tab fusionado, **When** se listan modelos de embedding detectados, **Then** se muestran como badges igual que en el tab "Modelos" original.

---

### User Story 3 — Corrección I-05: carga de la URL de Ollama (Priority: P1)

**Como** ADMIN,
**quiero** que el campo "URL base de Ollama" cargue el valor persistido (`http://localhost:11434`) al abrir el tab,
**para** poder probar la conexión y guardar sin tener que reescribir la URL a ciegas.

**Why this priority**: bug funcional que bloquea el guardado de la URL (botón disabled); el brief lo exige como parte del mismo cambio.

**Independent Test**: con ~103 parámetros en BD, abrir el tab: el campo URL muestra el valor persistido y el botón "Guardar URL" está habilitado. Cambiar la URL y guardar persiste vía PATCH (semántica actual intacta).

**Acceptance Scenarios**:

1. **Given** `system.ollama_base_url` persistido en BD más allá de la primera página de 25 parámetros, **When** `IaModelSelector` carga, **Then** obtiene el valor por su clave (`GET /api/config/parametros/system.ollama_base_url`) y rellena el campo.
2. **Given** el campo cargado, **When** el ADMIN pulsa "Guardar URL", **Then** el PATCH persiste y aparece el mensaje "Guardado".
3. **Given** `reportes.classification_model` persistido, **When** el componente carga, **Then** el selector muestra el modelo activo (también cargado por clave, no por lista paginada).
4. **Given** una clave inexistente en BD (404), **When** el componente carga, **Then** el campo queda vacío sin romper el resto de la UI (mismo comportamiento tolerante actual).

---

### Edge Cases

- **URL antigua `?tab=modelos`**: la clave deja de existir en `TABS`; `activeTab` cae al default ("documentacion"). Aceptable; se evalúa redirigir a "playground" como cortesía (decisión en plan: no es necesaria, el fallback actual ya evita roturas).
- **Clave no persistida aún** (p. ej. instalación nueva): GET por clave devuelve 404 → el componente muestra campo vacío, igual que hoy cuando el parámetro no viene en la lista.
- **Parámetro secreto**: ninguno de los dos (`system.ollama_base_url`, `reportes.classification_model`) es `esSecreto`; si lo fueran, el endpoint devuelve `valor: null` y el campo quedaría vacío (comportamiento seguro por diseño).
- **Ollama apagado**: `fetchModels` ya maneja el error con mensaje; la fusión no toca ese flujo.

## Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE eliminar el tab "Modelos" de `TABS` en `src/app/dashboard/admin/ia/page.tsx`, quedando: Documentación, Playground, Eval, Configuración.
- **FR-002**: El tab "Playground" DEBE renderizar el contenido completo de `IaModelSelector` encima de `IaPlayground`, sin alterar el árbol interno de ninguno de los dos componentes.
- **FR-003**: El sistema DEBE conservar el 100% de las acciones existentes: probar conexión, guardar URL, seleccionar/guardar modelo activo, "Probar con este modelo", badges de embeddings, y todo el sandbox (overrides, resultados, trazas).
- **FR-004**: `IaModelSelector` DEBE cargar `system.ollama_base_url` y `reportes.classification_model` mediante `GET /api/config/parametros/{clave}` (uno por clave), en vez de la lista paginada `/api/config/parametros`.
- **FR-005**: La semántica de guardado (PATCH a `/api/config/parametros/{clave}`) NO DEBE cambiar; tampoco el backend de IA ni los endpoints.
- **FR-006**: Una URL con `?tab=modelos` NO DEBE romper la página (fallback al tab por defecto).
- **FR-007**: El estado local `params` del componente DEBE mantenerse consistente tras guardar (mismo comportamiento actual de actualización optimista).

### Key Entities

- **Tab del Centro de Control IA**: entrada del arreglo `TABS` en `page.tsx`; la navegación es por querystring (`?tab=`).
- **`ParametroSistema`**: par clave/valor persistido; claves afectadas: `system.ollama_base_url`, `reportes.classification_model`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: En `/dashboard/admin/ia?tab=playground`, el campo "URL base de Ollama" muestra `http://localhost:11434` (valor persistido) al cargar, con 103 parámetros en BD.
- **SC-002**: "Guardar URL" y "Probar conexión" están habilitados al cargar y el guardado persiste (verificable recargando el tab).
- **SC-003**: Todas las acciones listadas en FR-003 funcionan en el tab fusionado (checklist manual recorrido al 100%).
- **SC-004**: Gate de calidad verde: `npm run lint`, `npm run test`, `npm run build`, `npx tsc --noEmit`.
- **SC-005**: Ninguna referencia residual al tab "modelos" en `src/`.

## Assumptions

- Es una fusión de UI: no hay rediseño visual ni cambios de copy; se reubican componentes tal cual.
- El endpoint GET por clave es estable y su shape (`{ ...param, valor, historial }`) no cambia.
- La navegación por querystring se mantiene; los overrides del playground siguen llegando por `searchParams`.
- Los tests existentes de los endpoints (`route.test.ts`) no se ven afectados: no se toca backend.

## Implementación

**Fecha**: 2026-07-22 · **Cierre completo**: [`cierre.md`](./cierre.md)

- `page.tsx`: tab "Modelos" eliminado; el tab "Playground" compone `<IaModelSelector />` + `<IaPlayground />`.
- `IaModelSelector.tsx` (I-05): `fetchParams()` pide cada parámetro por clave (`GET /api/config/parametros/{clave}`), tolerante a 404; PATCH intacto.
- Test nuevo `IaModelSelector.test.tsx` (3/3): regresión I-05, modelo activo por clave, 404 tolerante.
- Fix adyacente de gate: `{ timeout: 20000 }` en `validar-anonimizacion/route.test.ts` (flake de latencia Ollama bajo suite completa, sin tocar lógica).
- Verificado en `:5005`: URL `http://localhost:11434` cargada por clave, PATCH persiste, 4 tabs (sin "Modelos"), URL vieja `?tab=modelos` cae al fallback.
- Gate: lint 0 errores · tsc OK · **719/719 tests** · build limpio · `dev-restart.sh` healthcheck OK.
- Commit: `feat(admin-ia): fusiona Playground+Modelos y corrige carga de config (spec 082, I-05)`.
