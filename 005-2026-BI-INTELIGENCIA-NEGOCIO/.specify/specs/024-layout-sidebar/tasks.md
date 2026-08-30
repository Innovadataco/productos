# TASKS-024 · Layout + Sidebar navegación

## F1 · Componentes base
- [x] `src/components/bi/layout/BiSideNav.tsx` con 4 secciones, estado activo por `usePathname()`, `aria-current="page"`
- [x] `src/components/bi/layout/BiAppShell.tsx` con grid `[240px_1fr]`, sidebar + main

## F2 · Segment `/dashboard`
- [x] `src/app/dashboard/layout.tsx` · Server Component · reutiliza `sesionDeRequest` (SOLO LECTURA) · redirect a `/login` si no hay sesión
- [x] `src/app/dashboard/page.tsx` · esqueleto "Home BI" con placeholders documentando qué SPEC lo puebla

## F3 · Landing
- [x] `src/app/page.tsx` · redirect a `/dashboard`

## F4 · Tests unitarios
- [x] `tests/unit/bi-layout-sidebar.test.tsx` · 5 tests · verdes
- [x] `tests/unit/bi-dashboard-page.test.tsx` · 1 test · verde

## F5 · Gate local (2026-08-29 20:48 COT)
- [x] `rm -rf .next && npm run build` verde (10 rutas · `/`, `/dashboard`, `/login`, `/chat`, `/api/health`, `/api/bi/*`)
- [x] `npm run typecheck` verde
- [x] `npx vitest run` · **117 passed · 15 skipped · 0 failed** en suite completa
- [x] `bash scripts/ratchets/{cero-sql-raw,cero-secretos,imports-llm-solo-motor,no-additional-properties-true}.sh` verdes (mv-schema-check SKIP en Dev BI-2 · pre-existente)
- [x] `curl -sI http://localhost:3011/` → `307 · location: /dashboard`
- [x] `curl -sI http://localhost:3011/dashboard` sin cookie → `307 · location: /login`
- [x] `curl -sI http://localhost:3011/login` → `307 · location: https://pi.innovadataco.com/login`
- [x] `curl -sI http://localhost:3011/chat` → `200` (no protegido por dashboard guard)

## F6 · Push
- [ ] `git add` archivos + tests + tasks.md actualizado
- [ ] `git commit -m "feat(bi): SPEC-024 layout + sidebar navegación"`
- [ ] `git push origin work/bi-SPEC-024-layout-sidebar`

## Cierre
- [ ] Señal a Fábrica: `desarrollo-bi-2: BI-SPEC-024 · REALIZADO · <hash> · gh pr checks OK`
