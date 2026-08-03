# Tasks: SPEC-157 — Sistema de diseño de Protección Infantil

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> **STUB — compuerta §4.** Se detalla con `/speckit.tasks` después de que ZEUS apruebe
> spec+plan y resuelva D1–D3. Orden previsto (dependencias):

## Fase 1 — Tokens (US1)

- [ ] T001 Variables CSS en `globals.css` (`:root`/`.dark`): color por canal RGB,
      tipografía, radios, sombras, espaciado, `--curva` (research D-R1)
- [ ] T002 `tailwind.config.ts`: colores por `var(--…-rgb)` con `<alpha-value>`,
      familias serif/sans/mono, `transitionTimingFunction.barrido`; mapeo
      `primary→cielo`, `accent→pino` (research D-R2)
- [ ] T003 Reescritura de la capa semántica sobre tokens (glass family, text-*,
      bg-page, ring-accent*, gradientes, scrollbars, focus) + `theme-colegio` como
      alias compatible — sin tocar pantallas

## Fase 2 — Tipografía (US2)

- [ ] T004 Vendorizar fuentes (Instrument Sans variable + Serif regular/italic +
      OFL.txt) y `next/font/local` en `layout.tsx`; Inter fuera; themeColor → pino
- [ ] T005 Escala tipográfica §4.1 como utilidades (titular estado clamp, H1, sección,
      cuerpo, microetiqueta, tabular-nums)

## Fase 3 — Primitivos (US3)

- [ ] T006 [P] `Anillo` + test (dos anillos SVG, trazo 17, draw-in, leyenda en
      personas, escalas, reduced-motion)
- [ ] T007 [P] `LuzAmbiental` + `PanelVidrio` + tests (luz por estado, blur/saturate,
      luz interior en oscuro)
- [ ] T008 [P] `Declaracion` + test (palabra de estado en cursiva serif + color de
      estado)

## Fase 4 — Movimiento, ratchet y cierre

- [ ] T009 Keyframes del sistema con la curva única + media query global
      `prefers-reduced-motion` (research D-R4)
- [ ] T010 [P] Script `tokens:check` (solo si D2=a) + contraste de pares de tokens
      (script a11y)
- [ ] T011 Quickstart completo + gate (tsc && lint && test:coverage && build &&
      arch:check) + `dev-restart.sh` + PR auto-merge + CI HEAD success
