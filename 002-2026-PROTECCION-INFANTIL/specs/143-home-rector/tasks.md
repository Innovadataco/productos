# Tasks: SPEC-143 — Home operativo del rector

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> **STUB — compuerta §4.** Se detalla con `/speckit.tasks` después de que ZEUS apruebe
> spec+plan y resuelva D1–D3. Orden previsto (dependencias):

## Fase 1 — Datos (US1, US2, US3)

- [ ] T001 `ColegioResumenRepository.homeRector` + extensiones de repos (contar
      activos estudiante/curso, contar profesores, alertas por periodo + DISTINCT,
      cobertura ×2, series ×3, top cursos 30d + titular, última señal) + test A/B
- [ ] T002 [P] `semaforo.ts` (regla D1, pura) + test · `fechas-humano.ts` (fecha
      larga + relativo) + test

## Fase 2 — Componentes (US1-US4)

- [ ] T003 [P] `HeroEstado` + `FranjaVigilancia` (Declaracion + LuzAmbiental +
      punto pulso + franja)
- [ ] T004 [P] `AnillosProteccion` (Anillo grande + huecos en personas)
- [ ] T005 [P] `TendenciaReportes` ("use client", Recharts + toggle) +
      `CursosQueMerecenMirada`
- [ ] T006 [P] `AccionesRapidas` + `EmptyStateColegio` (§5.2) + CanalesOficiales
- [ ] T007 `page.tsx` reemplazada (server, una llamada) + `HomeRectorPage`

## Fase 3 — Deps, calidad y cierre

- [ ] T008 `recharts` + `lucide-react` fijadas + `06-stack.md` regenerado +
      `arch:check` VERDE
- [ ] T009 Tests de componentes (estados, empty, a11y) + grep terminología §3 +
      tokens:check ≤ 1166 + Lighthouse ≥ 90
- [ ] T010 Quickstart + gate completo + `dev-restart.sh` + PR auto-merge + CI HEAD
      success + nota "SPEC-129 C2/C3 superada" en el cierre
