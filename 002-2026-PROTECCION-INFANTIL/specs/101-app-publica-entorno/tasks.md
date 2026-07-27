# Tasks — Spec 101: App pública y entorno (I-23 / I-24 / A-2)

> Backfill documental (cierre cola 002-PI-014): tareas ejecutadas, reconstruidas del
> cierre.md y el commit `4e49b1a8`. Todas completadas.

- [x] T001 I-23 (🔴): quitar nivel de riesgo/score de `/dashboard-publico` — `src/components/modules/PublicDashboard.tsx` (sin `porNivelRiesgo`/`scorePromedio`, render defensivo), `src/app/dashboard-publico/page.tsx` (metadata).
- [x] T002 I-23: eliminar código muerto — `RIESGO_LABELS`/`RIESGO_COLORS`/`formatNivel` en `src/lib/labels.ts` y `src/components/modules/RiskBadge.tsx` (borrado; verificado sin uso con grep).
- [x] T003 I-24: sondeo con fuente única — `src/app/api/admin/ia/ollama/probar/route.ts` reescrito (sin URL del cliente; `getOllamaBaseUrl()` + `isLocalOllamaUrl`), `ERROR_CODES.SERVICE_UNAVAILABLE` en `src/lib/errors.ts`.
- [x] T004 I-24: degradación con gracia — fetch rechazado → 503 controlado `{ ok:false, "Ollama inalcanzable" }`.
- [x] T005 A-2: corregir arco SVG de `InboxIcon` en `src/components/modules/AdminNav.tsx` (`a2.25 2.25 0 002.25-2.25`); validación arc-aware de todo el repo.
- [x] T006 [P] Tests: `PublicDashboard.test.tsx` (3) y `ollama/probar/route.test.ts` (2).
- [x] T007 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` (911/911) + `npm run build`.
- [x] T008 `cierre.md` + fila en `specs/README.md` + commit `4e49b1a8` + push.
