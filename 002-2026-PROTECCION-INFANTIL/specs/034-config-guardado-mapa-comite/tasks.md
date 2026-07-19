# Tasks — Spec 034

## Phase 1 — Artefactos Spec-Kit
- **T001 [P]** Crear directorio y artefactos del spec 034
  - Ruta: `specs/034-config-guardado-mapa-comite/`
  - Entregables: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`, `tasks.md`, `contracts/`

## Phase 2 — User Story 1: Redirect y protección del rol Comité
- **T002** Incluir `COMITE_VALIDACION` en redirect post-login
  - Ruta: `src/app/login/page.tsx`
  - Dependencias: Ninguna
- **T003** Redirigir roles internos desde `/mis-reportes`
  - Ruta: `src/app/mis-reportes/page.tsx`
  - Dependencias: T002
- **T004** Redirigir roles internos desde `/dashboard/circulo-confianza`
  - Ruta: `src/app/dashboard/circulo-confianza/page.tsx`
  - Dependencias: T002

## Phase 3 — User Story 2: Guardado explícito con UPSERT
- **T005** Añadir UPSERT en endpoint `PATCH /api/config/parametros/[clave]`
  - Ruta: `src/app/api/config/parametros/[clave]/route.ts`
  - Dependencias: Ninguna
  - TDD: añadir/actualizar tests del endpoint.
- **T006** Reemplazar autosave por botón "Guardar cambios" + dirty state + confirmación
  - Ruta: `src/components/modules/CategoriaGruposEditor.tsx`
  - Dependencias: T005
- **T007** Añadir advertencia de cambios sin guardar e indicador dirty en `ConfigPanel.tsx`
  - Ruta: `src/components/modules/ConfigPanel.tsx`
  - Dependencias: Ninguna

## Phase 4 — User Story 3: Rediseño visual del mapa
- **T008** Mapear nombres de país español↔GeoJSON
  - Ruta: `src/components/modules/MapaUbicaciones.tsx`
  - Dependencias: Ninguna
- **T009** Rediseñar estilos, leyenda, burbujas con etiquetas y hover
  - Ruta: `src/components/modules/MapaUbicaciones.tsx`
  - Dependencias: T008
- **T010** Ajustar `PublicDashboard.tsx` si es necesario
  - Ruta: `src/components/modules/PublicDashboard.tsx`
  - Dependencias: T009

## Phase 5 — Validación
- **T011 [P]** Ejecutar lint, types y tests
  - Ruta: raíz del proyecto
  - Dependencias: T002, T003, T004, T005, T006, T007, T009, T010
- **T012** Build limpio y deploy con `dev-restart.sh`; probar con `quickstart.md`
  - Ruta: raíz del proyecto
  - Dependencias: T011

## Phase 6 — Cierre
- **T013** Commits, push y documentación de cierre
  - Ruta: raíz del proyecto
  - Dependencias: T012
  - Entregables: `cierre.md`, sección Implementación en `spec.md`, deuda técnica, git log.
