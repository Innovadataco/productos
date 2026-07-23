# Tasks — Spec 086: Navegación y páginas gobernadas por permisos

**Spec**: `specs/086-navegacion-gobernada-permisos/spec.md` · **Mapeo aprobado (con 4 correcciones)**: `research.md`

## Fase 1 — Catálogo y datos

- [x] T001 Migración aditiva de datos: `revision_spam` + backfill solo desde `anti_abuso`; fusión `reportes_revision`→`bandeja_reportes` con semántica AND; borrado de la fila fundida.
- [x] T002 `src/lib/permisos-catalogo.ts`: +`revision_spam`, −`reportes_revision`. Seed: backfill actualizado.

## Fase 2 — Re-claveo de guards API

- [x] T003 `/api/admin/spam/**` → `revision_spam`; `/api/admin/reportes-revision/**` + `/api/admin/correcciones` → `bandeja_reportes`.

## Fase 3 — Navegación por permisos

- [x] T004 `src/lib/nav-items.ts`: ítems de las 3 navs con `{ href, label, modulo }`.
- [x] T005 `AdminNav` + `dashboard/admin/layout.tsx`: claves permitidas server-side; eliminar `roles` de `allLinks`.
- [x] T006 `ColegioNav` (desde `colegio/layout.tsx`) y `ComiteSubNav` (prop) por módulo.
- [x] T007 Tabs del centro IA filtradas por submódulo en `dashboard/admin/ia/page.tsx`.

## Fase 4 — Guard de página + aterrizaje

- [x] T008 `verificarAccesoPagina` + `SinAccesoModulo` en `src/lib/permisos-modulos.ts` (+ componente).
- [x] T009 Guard en todas las páginas `/dashboard/admin/**` y `/dashboard/colegio/**` (mapeo §4).
- [x] T010 Aterrizaje: `/dashboard/admin` redirige al primer módulo permitido; pantalla "Sin módulos asignados" si no hay ninguno.

## Fase 5 — Tests y cierre

- [x] T011 Test estructural menú↔catálogo + tests nav/guard.
- [x] T012 Prueba del CEO (quickstart, incl. aterrizaje) + gate + dev-restart.
- [x] T013 data-model.md, contracts (N/A), checklists, cierre.md (con lista de restringidos AND) + commit + push.
