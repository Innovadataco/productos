# Cierre: SPEC-157 — Sistema de diseño de Protección Infantil

**Fecha**: 2026-08-03 · **Radicado**: 002-PI-058 · **Spec**: [spec.md](./spec.md)

## Evidencia

- Compuerta §4: spec+plan `e6c10fab` → ZEUS REVISO → **CUMPLE** con D1–D3 + candado
  git-diff.
- PR #18 (docs): `badf23de` · PR #19 (implementación): `54e601ec`. Ambos
  squash-mergeados a `feature/001-scaffolding` con `gate` verde.
- Gate local completo verde antes de push: `tsc` 0 · `lint` 0 · `tokens:check` 0 ·
  `test:coverage` (260 archivos, 1556 passed / 1 skipped preexistente) · `build` 0 ·
  `arch:check` VERDE · `./scripts/dev-restart.sh` OK.
- Candado SC-001 (`git diff --stat`): en `src/` solo `globals.css`, `layout.tsx` y
  archivos NUEVOS (`ui/Anillo`, `ui/LuzAmbiental`, `ui/PanelVidrio`, `ui/Declaracion`
  + tests, `lib/design-tokens.test.ts`). Cero pantallas existentes tocadas.
- Conteos semánticos tras la reescritura: `glass` 118 ≥ 109 · `text-body` 458 ≥ 457 ·
  `text-muted` 377 ≥ 375 · `text-subtle` 165 ≥ 165.

## Medición del piso del ratchet (D2 — comando exacto declarado)

Piso sembrado: **1166 ocurrencias en 116 archivos** (`src/**` productivo, excluye
`*.test.ts(x)`). Comando exacto con que se midió:

```bash
grep -rEo '\b(text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(/[0-9]{1,3})?\b' src --include='*.ts' --include='*.tsx' --exclude='*.test.ts' --exclude='*.test.tsx' | wc -l
```

`scripts/tokens-check.ts` reproduce ese conteo en Node y falla si SUBE (el piso solo
baja); paso `npm run tokens:check` añadido al job `gate` de
`.github/workflows/ci.yml` (workflow exclusivo de 002), justo tras `lint`.

## Qué se entregó (FR → evidencia)

- FR-001/002 (tokens + capa semántica): `src/app/globals.css` reescrito sobre
  variables por canal RGB (`rgb(var(--X-rgb) / <alpha>)`); `tailwind.config.ts`
  expone tokens; `primary→cielo` y `accent→pino` mapeados (9 usos legacy intactos);
  `theme-colegio` conservado como alias.
- FR-003/004 (tipografía): Instrument Sans (variable 400-700 + cursiva), Instrument
  Serif (regular + cursiva), DM Mono (400/500) — woff2 de fonts.gstatic.com, latin +
  latin-ext (~64 KB las Instrument, verificado byte a byte contra la referencia de
  ZEUS), `next/font/local` en `layout.tsx`, Inter eliminado (0 refs), `themeColor` →
  `#0b6e5a`, `OFL.txt` incluido. Escala §4.1 como utilidades + `tabular-nums` +
  palabra de estado en cursiva serif.
- FR-005 (primitivos): `Anillo`, `LuzAmbiental`, `PanelVidrio`, `Declaracion` con
  tests propios.
- FR-006 (movimiento): `--curva: cubic-bezier(.16,1,.3,1)` única; pulso 3,4 s único
  bucle (`pulseSlow` legacy re-apuntado a 3,4 s + curva); media query global
  `prefers-reduced-motion` que apaga todo.
- FR-007 (ratchet): arriba.
- FR-008 (dos temas, mismo HTML): tokens en `:root`/`.dark`; ThemeProvider intacto.
- SC-003 (contraste): test `src/lib/design-tokens.test.ts` (16/16) parsea los valores
  reales del CSS — claro: tinta 15.89, muted 6.75, subtle 4.85, pino 5.44,
  ambar-ink 5.11, rubí 4.90 · oscuro: 18.29/9.53/6.85/11.97/10.72/7.97 — todos
  ≥ 4.5:1.

## Desviaciones y hallazgos

1. **`--ambar-ink-rgb`**: el ámbar claro del brief (`#a9700c`) da 3.69:1 como texto
   sobre papel (no cumple AA). Se conserva `--ambar-rgb` para trazos/rellenos y se
   derivó `--ambar-ink-rgb: #8a5c06` (5.11:1) para TEXTO de estado en claro (en
   oscuro, ink = token base). Análogos `--pino-ink`/`--rubi-ink` (= base, ya dan AA).
   Decisión de implementación documentada en el CSS y en el test de contraste.
2. **Token `subtle` claro al 62%** (no 60%): el 60% daba 4.53:1 sin margen; se subió
   a 62% → 4.85:1. Documentado en el CSS.
3. **`pulseSlow` legacy** (usado por pantallas actuales): se re-apuntó de
   `3s ease-in-out` a `3.4s var(--curva)` para alinearlo con §4.5; `floatUp`/`fadeIn`
   conservan keyframes, solo cambia el easing.
4. Sin hallazgos preexistentes nuevos en esta SPEC.

## Deuda técnica generada

- Las 1166 ocurrencias de color crudo en 116 archivos migran POR DESGASTE (cada spec
  que toque una pantalla la tokeniza; el ratchet impide que suba).
- Íconos hero SVG (§8 del brief) pendientes: llegan con SPEC-143/146.
- `lucide-react`/`recharts` se añaden en las specs de pantalla que los usen.
