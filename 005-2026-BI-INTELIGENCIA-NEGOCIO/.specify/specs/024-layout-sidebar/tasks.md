# TASKS-024 · Layout + Sidebar navegación

## F1 · Componentes base
- [ ] `src/components/bi/layout/BiSideNav.tsx` con 4 secciones, estado activo por `usePathname()`, `aria-current="page"`
- [ ] `src/components/bi/layout/BiAppShell.tsx` con grid `[240px_1fr]`, sidebar + main

## F2 · Segment `/dashboard`
- [ ] `src/app/dashboard/layout.tsx` · Server Component · reutiliza `sesionDeRequest` (SOLO LECTURA) · redirect a `/login` si no hay sesión
- [ ] `src/app/dashboard/page.tsx` · esqueleto "Home BI" con placeholders documentando qué SPEC lo puebla

## F3 · Landing
- [ ] `src/app/page.tsx` · redirect a `/dashboard`

## F4 · Tests unitarios
- [ ] `tests/unit/bi-layout-sidebar.test.tsx` · 4 tests (render 4 secciones · aria-current activo por pathname · mock `next/navigation` para 3 pathnames · shell renderiza children)
- [ ] `tests/unit/bi-dashboard-page.test.tsx` · 1 test (título + placeholder)

## F5 · Gate local
- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run typecheck` verde
- [ ] `npm run test:unit` verde (nuevos + existentes)
- [ ] `bash scripts/ratchets/run-all.sh` (4/5 verdes esperados · mv-schema-check SKIP en Dev BI-2)
- [ ] `curl -I http://localhost:3001/` → 307 a `/dashboard`
- [ ] `curl -I http://localhost:3001/dashboard/` sin cookie → 307 a `/login`

## F6 · Push
- [ ] `git add` archivos listados en plan.md F6
- [ ] `git commit -m "feat(bi): SPEC-024 layout + sidebar navegación"`
- [ ] `git push origin work/bi-SPEC-024-layout-sidebar`
- [ ] `gh pr view` verifica checks OK

## Cierre
- [ ] Señal a Fábrica: `desarrollo-bi-2: BI-SPEC-024 · REALIZADO · <hash> · gh pr checks OK`
