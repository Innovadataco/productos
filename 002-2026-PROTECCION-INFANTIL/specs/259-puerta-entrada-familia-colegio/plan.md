# Implementation Plan: SPEC-259 — Puerta de entrada familia / colegio

**Branch**: `work/002-PI-rescate-pagos` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Crear la página `/registro/inicio` con el sistema visual de PI (anillos, Instrument Serif+Sans, tokens `cielo` y `pino`, radios 16/12/22) y redirigir el enlace de `/login` a ella. Conservar `/registro` (familia) y `/registro-colegio` (colegio) sin cambios. Verificar AA con `contrast_check.js`.

## Technical Context

**Language/Version**: TypeScript 5, React 19
**Primary Dependencies**: Next.js 16 App Router, Tailwind 3.4, tokens del design system PI
**Storage**: N/A
**Testing**: test de render (Testing Library) verifica las 2 tarjetas + enlace a login + hrefs correctos.
**Target Platform**: browser (mobile-first)
**Project Type**: web-service
**Performance Goals**: página estática/RSC ligero
**Constraints**: Solo tokens (SPEC-157/FR-007); AA (SC-009); no tocar `/registro` ni `/registro-colegio`.
**Scale/Scope**: 1 archivo nuevo + 1 línea en `login/page.tsx`.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| §3.1 TS strict | ✅ | Props tipadas. |
| SPEC-157 tokens | ✅ | Cero color crudo. |
| Candado motor IA | ✅ | No aplica. |
| Sistema de diseño (BRIEF-UX-Rector §4) | ✅ | Anillos, Instrument, radios. |

## Project Structure

```text
specs/259-puerta-entrada-familia-colegio/
├── spec.md
├── plan.md
├── quickstart.md   # cómo probar en dev
└── tasks.md

src/app/registro/inicio/page.tsx      # nueva puerta
src/app/registro/inicio/page.test.tsx  # test render
src/app/login/page.tsx                 # 1 línea: href="/registro/inicio"
```

**Structure Decision**: Option 1. Página nueva bajo `src/app/registro/inicio/` (subruta de registro). Colegio en `/registro-colegio` queda intacto — usa segmento hermano con guion, no un subpath.

## Decisiones técnicas (para auditoría de ZEUS)

### Decisión 1 — La puerta va en `/registro/inicio`, no en `/registro`
El brief §6 dice a la vez "familia → `/registro` (formulario actual, sin cambios)" y "el enlace de login apunta a la nueva pantalla de selección". Ambas son incompatibles si la puerta vive en `/registro`. Se resuelve creando `/registro/inicio` (subruta natural, sin colisión) y apuntando `login/page.tsx:68` a esa nueva ruta. La ventaja: **cero cambio en `/registro` y `/registro-colegio`** — como el brief exige. La desventaja menor: un click adicional para quienes tipearan `/registro` directamente; se acepta como coste bajo. Alternativa descartada: cambiar `/registro` a puerta y mover formulario familia a `/registro/familia` — rompe el "sin cambios" y quiebra URLs bookmarked.

### Decisión 2 — Anillo de protección reutiliza componente existente
Si `src/components/ui/Anillo.tsx` (o similar) ya existe, se importa. Si no, se agrega un SVG inline mínimo con opacidades por token. En cualquier caso, cero color crudo — el anillo se pinta con `stroke-cielo` / `stroke-pino` (o clases equivalentes del design system).

### Decisión 3 — `Instrument Serif` para voz, `Instrument Sans` para interfaz
Se aplica según BRIEF-UX-Rector §4. Si las fuentes no están cargadas globalmente, se agregan en el layout raíz del app router — Fase 0 lo confirma.

## Complexity Tracking

Ninguna violación.
