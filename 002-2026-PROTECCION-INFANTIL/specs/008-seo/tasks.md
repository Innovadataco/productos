# Tasks: SEO y Metadatos

**Input**: Design documents from `/specs/008-seo/`

## Phase 1: Metadata base

- [ ] T001 Corregir `src/app/layout.tsx`: mover `themeColor` a export `viewport` (ya realizado en deuda técnica).
- [ ] T002 Definir `metadata` base con title, description, manifest, icons, appleWebApp y OpenGraph en `layout.tsx`.
- [ ] T003 Añadir `metadata` en `src/app/page.tsx` (landing).
- [ ] T004 Añadir `metadata` en `src/app/reportar/page.tsx`.
- [ ] T005 Añadir `metadata` en `src/app/seguimiento/page.tsx`.
- [ ] T006 Añadir `metadata` en `src/app/terminos/page.tsx`.
- [ ] T007 Añadir `metadata` en `src/app/privacidad/page.tsx`.
- [ ] T008 Añadir `metadata` en `src/app/offline/page.tsx`.

## Phase 2: robots y sitemap

- [ ] T009 Crear `src/app/robots.ts` permitiendo páginas públicas y bloqueando `/dashboard`, `/api`.
- [ ] T010 Crear `src/app/sitemap.ts` listando URLs públicas con `NEXT_PUBLIC_APP_URL`.

## Phase 3: Canonical y datos estructurados

- [ ] T011 Añadir canonical URL en el layout base usando `metadataBase` y `alternates.canonical`.
- [ ] T012 Añadir JSON-LD (`WebSite` / `Organization`) en `src/app/page.tsx`.

## Phase 4: Tests y validación

- [ ] T013 [P] Tests E2E verificando `<title>` y `<meta name="description">` en páginas públicas.
- [ ] T014 [P] Tests E2E para `/robots.txt` y `/sitemap.xml`.
- [ ] T015 Ejecutar gate completo: lint, test, build, e2e, tsc.
