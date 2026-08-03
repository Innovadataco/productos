# Tasks: SPEC-157 — Sistema de diseño de Protección Infantil

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**:
[research.md](./research.md)

Compuerta §4 superada (ZEUS 2026-08-03, CUMPLE): D1=DM Mono vendorizada local ·
D2=ratchet `tokens:check` EN EL GATE DE CI (solo `src/**` productivo, piso = medición
ODIN, número con comentario fecha+spec) · D3=woff2 directo de fonts.gstatic.com
(latin + latin-ext) + OFL.txt · Candado: SC-001 se audita con `git diff --stat`
(ninguna pantalla tocada salvo `src/app/layout.tsx`).

Reglas: TDD en primitivos (test primero) · commits lógicos en español imperativo ·
cero tests debilitados · prohibido Inter · prohibido color crudo en código nuevo ·
gate completo antes de push.

## Fase 1 — Tokens (US1)

- [x] T001 Variables CSS en `src/app/globals.css` (`:root`/`.dark`): color por canal
  RGB (pino, cielo, ambar, rubi, papel, tinta + derivados muted/subtle con contraste
  AA verificado), tipografía, radios, sombras, espaciado, `--curva:
  cubic-bezier(.16,1,.3,1)` (research D-R1)
- [x] T002 `tailwind.config.ts`: colores por `rgb(var(--…-rgb) / <alpha-value>)`,
  `fontFamily` (sans/serif/mono por var), `transitionTimingFunction.barrido`;
  `primary→cielo` y `accent→pino` mapeados (9 usos existentes no se rompen)
- [x] T003 Reescritura de la capa semántica sobre tokens (`glass*`, `text-body`,
  `text-muted`, `text-subtle`, `text-accent`, `text-gradient`, `accent-gradient`,
  `bg-page`, `ring-accent*`, scrollbars, focus fallback) + `theme-colegio` como
  alias compatible (research D-R2) — SIN tocar pantallas

## Fase 2 — Tipografía (US2)

- [x] T004 Descargar woff2 de fonts.gstatic.com (UA navegador contra css2): Instrument
  Sans (variable 400-700, normal+cursiva), Instrument Serif (regular+cursiva), DM
  Mono (400+500) — latin Y latin-ext de cada una → `public/fonts/` + `OFL.txt`
- [x] T005 `src/app/layout.tsx`: `next/font/local` para las 3 familias
  (`--font-instrument-sans`, `--font-instrument-serif`, `--font-dm-mono`); Inter
  FUERA (import y variable); `themeColor` → pino (`#0b6e5a`)
- [x] T006 Escala tipográfica §4.1 como utilidades en `globals.css` (titular de
  estado clamp serif, H1 46px serif, sección 21-22px serif, cuerpo 16.5px/1.65,
  microetiqueta 11px versalita .14em terciario) + utilidad de cifra con
  `tabular-nums` + utilidad de palabra de estado (cursiva serif + color de estado)

## Fase 3 — Primitivos (US3, TDD)

- [x] T007 [P] `src/components/ui/Anillo.tsx` + test: dos anillos SVG concéntricos
  (trazo 17, extremos redondeados, exterior=vigilancia, interior=reacción), centro
  escudo+número, leyenda en personas, escala 88px, draw-on-enter, reduced-motion
- [x] T008 [P] `LuzAmbiental.tsx` + `PanelVidrio.tsx` + tests: campo de luz por
  estado (pino/ámbar/rubí); panel `backdrop-filter: saturate(185%) blur(22px)`, luz
  interior en oscuro
- [x] T009 [P] `Declaracion.tsx` + test: titular serif con palabra de estado en
  cursiva serif y color de estado (token)

## Fase 4 — Movimiento, ratchet y cierre

- [x] T010 Keyframes del sistema con la curva única (entradas escalonadas, dibujo,
  pulso 3,4 s como ÚNICO bucle) + media query global `prefers-reduced-motion` que
  apaga TODO (research D-R4)
- [x] T011 `scripts/tokens-check.ts`: cuenta color crudo en `src/**` (excluye
  `*.test.ts(x)`), piso sembrado con la medición ODIN 2026-08-03 (constante con
  comentario fecha+spec), falla si SUBE + script `tokens:check` en package.json +
  PASO en `.github/workflows/ci.yml` (gate, tras lint)
- [x] T012 Contraste de pares de tokens ≥ 4.5:1 en ambos temas (script a11y o
  verificación en test del sistema)
- [x] T013 Verificación: conteos semánticos ≥ base (109/457/375/165) ·
  `git diff --stat` sin pantallas tocadas (solo layout.tsx en src/app/) · grep Inter
  = 0 · HTML sin googleapis/gstatic en runtime · quickstart completo
- [x] T014 Gate (tsc && lint && tokens:check && test:coverage && build &&
  arch:check) + `./scripts/dev-restart.sh` + PR auto-merge + CI HEAD success +
  `cierre.md` con el COMANDO EXACTO de medición del piso (D2)

## Analyze (speckit.analyze, 2026-08-03)

- Cobertura: US1→T001-T003 · US2→T004-T006 · US3→T007-T009 · FR-006→T010 ·
  FR-007→T011 · SC-003→T012 · SC-001/002/005/006→T013/T014. Toda FR tiene tarea;
  FR-008/009/010 son invariantes verificados en T013.
- Consistencia: D1-D3 y el candado git-diff reflejados en spec/research/checklist/
  tasks. Sin ambigüedades abiertas. Sin duplicados.
