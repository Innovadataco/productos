# Implementation Plan: SPEC-157 — Sistema de diseño de Protección Infantil

**Branch**: `work/002-pi-058-spec-157` (PR a `feature/001-scaffolding`) | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/157-sistema-diseno/spec.md`

## Summary

Instalar el sistema de diseño de Protección Infantil (brief v3.0 §4): variables CSS
reales para los dos temas (color con nombre, tipografía, radios, sombras, espaciado,
curva única de movimiento), reescritura de la capa semántica existente sobre esos
tokens sin romper sus 1.165+ usos, tipografía Instrument Serif/Sans auto-alojada con
`next/font/local` (Inter fuera), y cuatro primitivos nuevos (`Anillo`, `PanelVidrio`,
`LuzAmbiental`, `Declaracion`) con tests. NO se migran pantallas existentes: migran
por desgaste en las specs que las toquen.

## Technical Context

**Language/Version**: TypeScript 5 (strict) · Node.js >= 22
**Primary Dependencies**: Next.js 16.2.10 (App Router) · Tailwind CSS 3.4 · React 19 ·
`next/font/local` · Vitest + Testing Library
**Storage**: N/A (solo archivos de fuente vendoreados en el repo, SIL OFL)
**Testing**: Vitest + jsdom (componentes); script de contraste (a11y) para tokens
**Target Platform**: Web (iPad/celular first), temas claro+oscuro vía `darkMode:
"class"` (ThemeProvider existente)
**Project Type**: Web application
**Performance Goals**: fuentes auto-alojadas (0 llamadas runtime a Google);
animaciones solo CSS/transform (GPU), apagadas con `prefers-reduced-motion`
**Constraints**: cero pantallas migradas · cero tests debilitados · prohibido Inter ·
prohibido color crudo en código nuevo · una sola curva de movimiento
**Scale/Scope**: 2 archivos de sistema (`globals.css`, `tailwind.config.ts`) +
`layout.tsx` + ~4 fuentes vendoreadas + 4 primitivos con tests (+ script ratchet si
D2=a)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§1.3 Presunción de inocencia**: el lenguaje de estado es descriptivo, no
  veredictos — el sistema visual no introduce etiquetas de riesgo. ✓
- **§2.3 Multi-tenant**: N/A (sin datos). ✓
- **§3.1/§3.2 Tipado estricto**: primitivos con props tipadas, cero `any`. ✓
- **§7.3 Estilos**: Tailwind como única fuente; se fortalece con tokens (misma
  filosofía, más disciplina). ✓
- **§5 Testing**: cada primitivo con test; cero tests existentes tocados (FR-010). ✓
- **Candados del radicado**: prohibido Inter · solo tokens en código nuevo · mismo
  HTML dos temas · una curva · reduced-motion apaga todo · no tocar `src/lib/ai/**` ·
  I-29 intacto. ✓
- **Brief §6.5**: reusar `src/components/ui/`; los 4 primitivos son nuevos porque
  faltan (Anillo/LuzAmbiental/Declaracion no existen; PanelVidrio formaliza el vidrio
  §4.6 que `GlassCard` no cubre: luz ambiental por estado). ✓

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/157-sistema-diseno/
├── spec.md              # User Stories, FRs, D1-D3
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas (tokens con alpha, fuentes, ratchet)
├── data-model.md        # N/A — declarado explícitamente
├── quickstart.md        # Verificación manual
├── checklists/
│   └── requirements.md
└── tasks.md             # Stub — se detalla en /speckit.tasks tras aprobación
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── globals.css              # tokens :root/.dark + capa semántica reescrita
│   │                            # + escala tipográfica + movimiento + reduced-motion
│   └── layout.tsx               # next/font/local (Instrument), Inter fuera,
│                                # themeColor → pino
├── components/ui/
│   ├── Anillo.tsx               # + Anillo.test.tsx
│   ├── PanelVidrio.tsx          # + PanelVidrio.test.tsx
│   ├── LuzAmbiental.tsx         # + LuzAmbiental.test.tsx
│   └── Declaracion.tsx          # + Declaracion.test.tsx
├── lib/
│   └── (sin cambios de negocio)
public/
└── fonts/                       # InstrumentSans + InstrumentSerif + OFL.txt (D3)
tailwind.config.ts               # familias, colores por var(--token), curva única
scripts/
└── tokens-check.ts              # SOLO si D2=a (ratchet anti color crudo)
package.json                     # script tokens:check (si D2=a)
```

**Structure Decision**: un solo lugar para tokens (`globals.css` `:root`/`.dark`) y
un solo lugar para su exposición a Tailwind (config). Los primitivos van en
`src/components/ui/` como el resto, sin subcarpetas nuevas.

## Fase 0 — Research (ver research.md)

1. Tokens de color con alpha: variables por canal (`--pino-rgb: 11 110 90`) +
   `rgb(var(--pino-rgb) / <alpha>)` — compatible con opacidades sin colores crudos.
2. Fuentes: TTF oficiales `google/fonts` (SIL OFL) vendoreados; `next/font/local`
   con `variable` para Instrument Sans; serif regular+italic estáticos.
3. Ratchet anti color crudo (si D2=a): conteo por patrón, falla si sube.
4. Contraste: pares derivados de tokens verificados por script (WCAG AA).

## Fase 1 — Diseño

- Mapa token → valor (ambos temas) y token → clase semántica en `research.md`.
- Props de los 4 primitivos en `research.md` (contrato de componentes).
- Verificación en `quickstart.md`.

## Fase 2 — Tasks

`/speckit.tasks` tras aprobación de ZEUS (compuerta §4). Stub en `tasks.md`.

## Complexity Tracking

Sin violaciones de constitución que justificar.
