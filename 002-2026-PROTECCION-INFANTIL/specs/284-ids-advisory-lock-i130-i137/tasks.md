# Tasks — SPEC-284 · IDs de advisory lock únicos (I-130, I-137)

**Branch**: `work/002-PI-184`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 0 — Barrido triangulado (D-004 §1)

- **T000** [✓] Barrido de los 12 workers por **dos caminos independientes** (grep + parseo Node). Confirmado: 12 IDs, colisión única en `123456790` sobre `monitor-probes`, `worker-senal-comunitaria` (`123_456_790`), `worker-sesiones`, `worker-tasas`. Sin colisiones ocultas.

## Fase 1 — IDs únicos (US1, US4)

- **T001** [✓] `scripts/worker-senal-comunitaria.mjs:20`: `123_456_790` → `123456796` + comentario SPEC-284.
- **T002** [✓] `scripts/worker-sesiones.mjs:22`: `123456790` → `123456797` + comentario SPEC-284 + candado de orden.
- **T003** [✓] `scripts/worker-tasas.mjs:14`: `123456790` → `123456798` + comentario SPEC-284.

## Fase 2 — Fuente única de verdad (US2)

- **T004** [✓] `scripts/ADVISORY-LOCKS.md`: nueva tabla 12 filas + regla operativa.

## Fase 3 — Compuerta CI (US3)

- **T005** [✓] `scripts/locks-check.ts`: función `verificarLocks({scriptsDir, tablaPath})` + main + 5 s timeout + salida humana.
- **T006** [✓] `package.json`: `"locks:check": "tsx scripts/locks-check.ts"`.
- **T007** [✓] `.github/workflows/ci.yml`: paso `npm run locks:check` en job `verificaciones` tras `arch:check`.

## Fase 4 — Tests (SC-005..SC-009)

- **T008** [✓] `scripts/locks-check.test.ts`: SC-005 (feliz) · SC-006 (colisión con separadores) · SC-007 (desalineo tabla ↔ código) · rendimiento < 500 ms.

## Fase 5 — Registro spec-kit

- **T009** [✓] `specs/README.md`: entrada SPEC-284.

## Fase 6 — Gate y entrega

- **T010** [✓] Gate LOCAL: `tsc --noEmit` · `lint` · `tokens:check` · `arch:check` · `locks:check` · `test:unit`.
- **T011** [✓] Gate pre-push (I-101): fetch + rebase + `git diff --name-status origin/feature/001-scaffolding..HEAD` (solo archivos SPEC-284).
- **T012** [✓] Commits (mapa en plan.md §Commit map) + push.

---

## Restricciones activas

- 🔒 **Candado de orden**: no levantar `worker-sesiones` como servicio en esta SPEC — metería tercer contendiente al lock. Si aparece propuesta, PARA.
- 🔒 **No reclamar candado huérfano** (INSTRUCTIVO §Candados) — el lock lo tiene proceso vivo.
- 🔒 **NO tocar** `pg_try_advisory_lock` / `pg_advisory_unlock`.
- 🔒 **CERO** cambios en `src/lib/ai/**`.
- 🔒 **CERO** migraciones.
- **Regex** de la compuerta debe permitir literales con `_` y normalizarlos antes de comparar (D-004 §1).
