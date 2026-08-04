# Tasks: SPEC-143 — Home operativo del rector

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Research**: [research.md](./research.md)

Compuerta §4 superada (ZEUS 2026-08-03, CUMPLE): D1 = ámbar **72 h** + condición de
copy ("ya lo atendiste") · D2 = `COUNT(DISTINCT reporteId)` (KPI y tendencia) ·
D3 = DOS hechos (última señal del colegio + heartbeat del worker) y franja SOLO
VERDADES.

Reglas: TDD en repo/lib (test primero) · 100% tokens (ratchet ≤ 1166) · terminología
§3 · cero tests debilitados · gate completo antes de push.

## Fase 1 — Datos (US1, US2, US3)

- [x] T001 `src/lib/dal/repositories/colegio-resumen.ts` — `homeRector(colegioId)`
  con Promise.all (DTO de data-model.md): KPIs activos, cobertura ×2, alertas por
  periodo (DISTINCT reporteId), series ×3, top 3 cursos 30d + titular, última señal,
  contadores del semáforo (nuevas + 72 h) + `colegio-resumen.test.ts` (A/B tenant,
  fixture de cobertura 70/50, periodos, DISTINCT vs filas, cero N+1)
- [x] T002 [P] Extensiones de repos (sin cambiar semántica existente):
  `estudiante.contarActivos`, `curso.contarActivos` + titular en select,
  `profesor.contar`, `alerta-colegio`: conteos por periodo DISTINCT, groupBy
  semana/mes/año, top por curso 30d, max creadoEn — con tests
- [x] T003 [P] `src/lib/colegio/semaforo.ts` (`resolverEstado`, pura: rubí = nuevas >
  0, ámbar = 72 h > 0) + test · `src/lib/colegio/fechas-humano.ts` (fecha larga ES +
  relativo "hace 12 minutos") + test
- [x] T004 [P] `src/lib/worker-heartbeat.ts` (`leerHeartbeatWorker()` lee
  `WORKER_RUN_DIR/worker.heartbeat`) + refactor de `api/health/worker/route.ts`
  para usarlo (mismo comportamiento; tests existentes deben seguir verdes) + test

## Fase 2 — Componentes (US1–US4)

- [x] T005 [P] `HeroEstado` (Declaracion + LuzAmbiental + punto pulso + copy por
  estado, ámbar = "ya lo atendiste") + `FranjaVigilancia` (los DOS hechos D3 con sus
  etiquetas + semana + delta — solo verdades) + tests
- [x] T006 [P] `AnillosProteccion` (Anillo grande + huecos en personas + centro
  escudo+número) + test (fixture 70/50, sin NaN con 0)
- [x] T007 [P] `TendenciaReportes` ("use client", Recharts AreaChart + toggle
  12sem/12m/3a sin refetch + resumen sr-only) + `CursosQueMerecenMirada` (top 3 +
  titular + enlace + copy positivo) + tests
- [x] T008 [P] `AccionesRapidas` (rutas existentes; "Profesores" apunta a cursos
  hasta SPEC-148, documentado) + `EmptyStateColegio` (§5.2) + bloque
  `CanalesOficiales` + tests
- [x] T009 `HomeRectorPage` (composición) + `page.tsx` REEMPLAZADA (server, una
  llamada a homeRector, sin auth duplicada) — 100% tokens, terminología §3, tap
  targets ≥ 48px

## Fase 3 — Deps, calidad y cierre

- [x] T010 `recharts` + `lucide-react` (versiones fijadas) + regenerar
  `docs/architecture/06-stack.md` + `arch:check` VERDE
- [ ] T011 Verificación: grep terminología §3 = 0 prohibidas en lo nuevo ·
  `tokens:check` ≤ 1166 · Lighthouse mobile ≥ 90 (Perf+A11y) en `/dashboard/colegio`
  (implementación 2026-08-03: grep = 0 y tokens:check = 1166 VERDES; Lighthouse
  queda para el cierre con la app levantada — se intenta tras dev-restart)
- [ ] T012 Quickstart completo + gate (tsc && lint && tokens:check && test:coverage
  && build && arch:check) + `./scripts/dev-restart.sh` + PR auto-merge + CI HEAD
  success + cierre.md con nota "SPEC-129 C2/C3 superada"
  (implementación 2026-08-03: gate local VERDE + dev-restart OK; PR/CI/cierre.md
  quedan para el cierre con ZEUS — trabajo en `work/002-pi-058-spec-143-impl`)

## Analyze (speckit.analyze, 2026-08-03)

- Cobertura: US1→T001-T005,T009 · US2→T001,T006 · US3→T001,T002,T007 · US4→T008 ·
  FR-010→T010 · FR-014→T001-T009 · SC-005/006→T011. Toda FR tiene tarea; FR-013 es
  invariante verificado en T011/T012.
- Consistencia: D1 (72 h + copy), D2 (DISTINCT en KPI y series), D3 (dos hechos +
  solo verdades) reflejadas en spec/research/data-model/tasks. Sin ambigüedades
  abiertas. Sin duplicados.
