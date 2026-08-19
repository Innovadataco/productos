# Tasks: SPEC-180 — Fixes visuales del admin

**Modo**: autónomo (aprobado por CEO 2026-08-19, bajo riesgo UX).

- [ ] **T001** `OperacionTableroClient.tsx`: eliminar el `<nav>` interno y la función `cambiarTab` (el tab se navega por URL vía sub-nav); conservar lectura de `?tab=` y los effects por tab.
- [ ] **T002** `ComiteSubNav.tsx` + `OperadoresSubNav.tsx`: `bg-accent` → `bg-pino` en el tab activo.
- [ ] **T003** `src/lib/nav-items.ts`: retirar item "Monitoreo worker"; `src/app/dashboard/admin/monitoreo/worker/page.tsx` → redirect a operación.
- [ ] **T004** Dataset: bloque "Qué es esto" en criollo en `DatasetEntrenamientoPageClient.tsx`.
- [ ] **T005** Tests: actualizar `OperacionTableroClient.test.tsx` (sin nav interno) + unit del subnav intacto; grep `bg-accent` a secas = 0 en src/.
- [ ] **T006** Regenerar `docs/architecture/` + arch:check + gate completo + commit + PR.
- [ ] **T007** `cierre.md` + fila en `specs/README.md` (2 tablas).

---

## Plan (extracto verificado en fuente)

- `OperacionTableroClient.tsx:100-117` — nav interno a eliminar; `cambiarTab` (router.replace) queda innecesario porque el sub-nav navega con `<Link href>` reales.
- `bg-accent` a secas no genera CSS (accent es objeto 50-700 en tailwind.config.ts) → 3 ocurrencias: ComiteSubNav:30, OperadoresSubNav:31, OperacionTableroClient:111 (esta desaparece con T001).
- `ADMIN_NAV_ITEMS` (nav-items.ts:22) tiene "Monitoreo worker" → quitar; página → `redirect("/dashboard/admin/estadisticas/operacion")`. El endpoint `/api/health/worker` NO se toca.
- Dataset copy actual (línea ~114): "Registros utilizados para mejorar el clasificador de IA…" → expandir con origen (correcciones humanas anonimizadas) y uso (medir/afinar en Simulación).
