# Tasks — Spec 033

## Phase 1 — Artefactos Spec-Kit
- **T001 [P]** Crear directorio y artefactos del spec 033
  - Ruta: `specs/033-correcciones-vistas-roles/`
  - Entregables: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`, `tasks.md`, `contracts/`

## Phase 2 — User Story 1: Menú del rol Comité
- **T002** Incluir `COMITE_VALIDACION` como rol interno en `NavHeader.tsx` con estilos y menú propio
  - Ruta: `src/components/modules/NavHeader.tsx`
  - Dependencias: Ninguna
- **T003** Verificar protección `verifyAuth("PARENT")` en rutas de usuario final
  - Rutas: `src/app/api/reportes/mis-reportes/route.ts`, `src/app/api/circulo-confianza/route.ts`
  - Dependencias: Ninguna
  - TDD: añadir o verificar tests de API que rechacen roles distintos a `PARENT`.

## Phase 3 — User Story 2: Editor de grupos de categoría
- **T004** Sembrar el editor con `GRUPOS_CATEGORIA_FALLBACK` cuando el parámetro esté vacío
  - Ruta: `src/components/modules/CategoriaGruposEditor.tsx`
  - Dependencias: T001
- **T005** Mejorar advertencia visible de categorías sin agrupar
  - Ruta: `src/components/modules/CategoriaGruposEditor.tsx`
  - Dependencias: T004

## Phase 4 — User Story 3: Mapa real del dashboard público
- **T006** Descargar GeoJSON de países a `public/geo/world-countries.json`
  - Ruta: `public/geo/world-countries.json`
  - Dependencias: Ninguna
- **T007** Renderizar GeoJSON en `MapaUbicaciones.tsx` con coloreado por cantidad y popups
  - Ruta: `src/components/modules/MapaUbicaciones.tsx`
  - Dependencias: T006
- **T008** Pasar datos por país desde `PublicDashboard.tsx` al mapa
  - Ruta: `src/components/modules/PublicDashboard.tsx`
  - Dependencias: T007

## Phase 5 — Validación
- **T009 [P]** Ejecutar lint, types y tests
  - Ruta: raíz del proyecto
  - Dependencias: T002, T003, T004, T005, T007, T008
- **T010** Build limpio y deploy con `dev-restart.sh`; probar con `quickstart.md`
  - Ruta: raíz del proyecto
  - Dependencias: T009

## Phase 6 — Cierre
- **T011** Commits, push y documentación de cierre
  - Ruta: raíz del proyecto
  - Dependencias: T010
  - Entregables: `cierre.md`, sección Implementación en `spec.md`, deuda técnica, git log.
