# Tasks · SPEC-813

## Fase 1 · Derivación pura (mecanismo, sin copy) — HECHA
- [x] **T1** · `clasificarAvisoReps` + `debeMostrarAvisoCaducadoReps` + `requiereRevisionAdminReps` en
  `src/lib/profesional/reps/aviso-estado-reps.ts`. Discrimina por HECHO + relojes; fail-closed; `switch`
  exhaustivo (5º `EstadoReps` rompe `tsc`).
- [x] **T2** · Candado `aviso-estado-reps.candado.test.ts`: 8 estados + control positivo por mutación +
  atado por conducta a `repsElegible` + exhaustividad. RED-first verificado (7→`CADUCADO` lo pone rojo).
- [x] **T3** · Registro en `vitest.unit.includes.ts` (carril que bloquea vía `pi-gate`).
- [x] **T4** · Estado 8: verificado IMPOSIBLE (CHECK VALIDADO) + ya lockeado por el candado D-121 de #792.

## Fase 2 · Superficies — PENDIENTE (#792 en main + forma v4.0)
- [ ] **T5** · Aviso al profesional (banner) disparado por `debeMostrarAvisoCaducadoReps`, consumiendo
  `repsAlDia`/`/api/me`. Copy según forma v4.0 (no inventar).
- [ ] **T6** · Candado de copy (participio `habilitad[oa]s?` no predicado del profesional) sobre el texto
  renderizado.
- [ ] **T7** · Candado de NO-promesa (sin «se reasigna/reubicamos/avisaremos/notificamos»), dato real plantado.
- [ ] **T8** · Canal de admin para 5, 7 y 8 + su candado (no construir silencio nuevo).

## Notas
- Rama adelantada sobre #792; al mergear #792 (`--squash`): ramificar limpio de `origin/main` y
  **cherry-pick** de los commits de 813 (NO rebase).
- Cruce con SPEC-814 (reubicación / T7, Dev 2): si el estado 5 (`NO_ENCONTRADA`) debiera disparar
  reubicación, es decisión del CEO — las dos specs están separadas a propósito.
