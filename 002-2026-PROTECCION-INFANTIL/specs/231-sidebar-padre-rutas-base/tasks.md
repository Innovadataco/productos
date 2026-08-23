# Tasks — SPEC-231 · Sidebar padre + rutas base

## Fase 1: Setup y tema

- [ ] T001 [P] Agregar `.theme-padre` en `src/app/globals.css` con mapeo a tokens `cielo`.
- [ ] T002 [P] Agregar `PADRE_NAV_ITEMS` en `src/lib/nav-items.ts` con los 7 items.

## Fase 2: Componente sidebar

- [ ] T003 Crear `src/components/modules/padre/PadreSideNav.tsx` (patrón ColegioSideNav, color cielo, 7 items).
- [ ] T004 [P] Crear `src/components/modules/padre/PadreSideNav.test.tsx` (renderizado, estado activo, clases).

## Fase 3: Layout y páginas placeholder

- [ ] T005 Crear `src/app/dashboard/padre/layout.tsx` (guarda PARENT, tema, sidebar).
- [ ] T006 [P] Crear `src/app/dashboard/padre/page.tsx` (Inicio placeholder).
- [ ] T007 [P] Crear `src/app/dashboard/padre/expedientes/page.tsx` (placeholder).
- [ ] T008 [P] Crear `src/app/dashboard/padre/reportar/page.tsx` (placeholder).
- [ ] T009 [P] Crear `src/app/dashboard/padre/suscripcion/page.tsx` (placeholder).
- [ ] T010 [P] Crear `src/app/dashboard/padre/circulo-confianza/page.tsx` (placeholder).
- [ ] T011 [P] Crear `src/app/dashboard/padre/notificaciones/page.tsx` (placeholder).
- [ ] T012 [P] Crear `src/app/dashboard/padre/perfil/page.tsx` (placeholder).

## Fase 4: Gate local

- [ ] T013 `npx tsc --noEmit`
- [ ] T014 `npm run lint -- --no-cache`
- [ ] T015 `npm run arch:check`
- [ ] T016 `npm run test:unit`
- [ ] T017 `npm run test:integration`
- [ ] T018 `npm run build`
- [ ] T019 Humo con `next start`

## Fase 5: Push

- [ ] T020 Rebase + diff pre-push (solo archivos SPEC-231)
- [ ] T021 `git push --force-with-lease`
- [ ] T022 Crear PR y reportar REALIZADO
