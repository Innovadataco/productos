# Tasks — Spec 098: Afinamiento del motor (targeting, principal por gravedad, métrica)

> Backfill documental (cierre cola 002-PI-014): tareas ejecutadas, reconstruidas del
> cierre.md y los commits `e07890ab` y `27484b45`. Todas completadas.

- [x] T001 FR-003: métrica — `esperada === asignada` (abstención correcta, Δ=0) no cuenta como silencioso en `scripts/eval-dual-banco.ts`; modo `--rubrica-only` (reusa el detalle legacy de la corrida anterior).
- [x] T002 FR-002: `categoria` interna = MAYOR gravedad entre presentes en `src/lib/ai/rubrica.ts` (`obtenerSeveridades`, empate por % y alfabético); test de `rubrica.test.ts` actualizado al nuevo comportamiento.
- [x] T003 FR-001 (v1): decisivas de targeting compuestas en `src/lib/ai/rubrica-semilla.ts` + `scripts/actualizar-rubrica-098.ts` (propagación a BD existentes; seed es upsert no destructivo).
- [x] T004 Eval v1 completa (200, `--rubrica-only`): colapso 107/200 a revisión — las preguntas compuestas no sobreviven la copia verbatim. Guardada en `resultados-dual-098-v1-preguntas-largas.json`.
- [x] T005 FR-001 (v2): decisivas cortas afirmativas; param actualizado (local y prod); commit `27484b45`.
- [x] T006 Eval v2 completa (200): accuracy 44.5%, ESPS 70, 0 silenciosos peligrosos, subestimaciones 58 (mayoría abstenciones). **FR-004 NO alcanzado (≤4)** — documentado sin maquillar en plan.md y cierre.md.
- [x] T007 Experimento A/B (20 casos, misma sesión, con/sin targeting): targeting inocuo; la línea base (95% en esos 20) no es reproducible hoy (65%) — fragilidad verbatim+2/3 del motor 092 identificada como causa; recomendación de normalización registrada para spec futura.
- [x] T008 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` (917/917) + `npm run build`.
- [x] T009 Propagación a prod: app `e07890a` desplegada (deploy de la cola 014) y parámetro `ia.rubrica.preguntas` sincronizado a v2 vía `psql` (motor productivo: LEGACY, D-19, sin cambios).
- [x] T010 `cierre.md` (tabla antes/después, A/B, deuda) + `specs/README.md` + commits `e07890ab`/`27484b45`/`4c5640a2` + push.
