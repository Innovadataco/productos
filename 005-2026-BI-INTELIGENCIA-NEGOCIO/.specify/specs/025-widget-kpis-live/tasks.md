# TASKS-025 · Widget KPIs live (Home)

## F1 · Endpoint `GET /api/bi/kpis`
- [x] `src/app/api/bi/kpis/route.ts` con `sesionDeRequest` guard + `Promise.all` de 5 queries + 2 healthchecks
- [x] `safeQuery` aísla fallos por MV/tabla · endpoint responde 200 aunque una query falle
- [x] `toNum` convierte bigint→number y aplica candado 9 (0 filas → `null`)
- [x] Timeout 3 s por healthcheck externo · uno falla, los demás igual se muestran

## F2 · Componente `KpisDashboardHome`
- [x] `src/components/bi/kpis/KpisDashboardHome.tsx` Client Component con fetch al montar
- [x] Grid `1/2/3` cols responsive · 6 tarjetas
- [x] Estado loading + estado error (via `ErrorState`)
- [x] `valor: null` → "sin datos aún" en gris (candado 9)
- [x] `UptimeCard` con 3 chips (bi-next verde self · bi-vanna · pi-app)

## F3 · Integración `/dashboard`
- [x] `src/app/dashboard/page.tsx` importa y renderiza `<KpisDashboardHome />` bajo el título
- [x] Comentarios `// SPEC-027 · EstadoSistemaWidget` y `// SPEC-028 · SupersetLink` como marcadores
- [x] SPEC-024 mergeada al worktree antes de commit (merge 0f35eaf28)

## F4 · Tests unitarios
- [x] `tests/unit/bi-kpis-endpoint.test.ts` · 5 tests · verdes
- [x] `tests/unit/bi-kpis-componente.test.tsx` · 4 tests · verdes
- [x] `tests/unit/bi-dashboard-page.test.tsx` actualizado (SPEC-025 pobló el home · placeholder ya no existe)

## F5 · Gate local (2026-08-29 20:59 COT)
- [x] `rm -rf .next && npm run build` verde · 11 rutas incluyendo `/api/bi/kpis`
- [x] `npm run typecheck` verde
- [x] `npx vitest run` · **126 passed · 15 skipped · 0 failed** en suite completa
- [x] Ratchets 4/5 verdes (mv-schema-check SKIP · pre-existente)
- [x] `curl -sI http://localhost:3011/api/bi/kpis` sin cookie → `401 · {"error":"unauthorized"}`

## F6 · Push
- [ ] `git add` archivos + tests + tasks.md actualizado
- [ ] `git commit -m "feat(bi): SPEC-025 widget KPIs live"`
- [ ] `git push origin work/bi-SPEC-025-kpis-live`

## Cierre
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-025 · REALIZADO · <hash> · gh pr checks OK`
