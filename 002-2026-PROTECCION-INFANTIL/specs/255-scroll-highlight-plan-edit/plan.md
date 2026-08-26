# Implementation Plan: SPEC-255 — Scroll y resaltado al editar plan

**Branch**: `work/002-PI-rescate-pagos` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Cambio de UX puntual en `PlanesAdminCRUD.tsx`: `useRef` al form + `scrollIntoView` en `editar()` + clase condicional de resaltado en el `<tr>`. Cero ruta, cero API, cero migración.

## Technical Context

**Language/Version**: TypeScript 5, React 19
**Primary Dependencies**: Vitest + Testing Library (unit test)
**Storage**: N/A
**Testing**: `src/components/modules/PlanesAdminCRUD.test.tsx` (existente o nuevo)
**Target Platform**: browser (client component)
**Project Type**: web-service
**Performance Goals**: sin impacto
**Constraints**: solo tokens (cero color crudo, SPEC-157/FR-007).
**Scale/Scope**: 1 archivo (`.tsx`), ~10 líneas.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| §3.1 TS strict | ✅ | ref tipado `HTMLFormElement`. |
| SPEC-157 tokens | ✅ | fondo `bg-cielo/10` o `bg-ambar/10` — sin crudo. |
| Candado motor IA | ✅ | No aplica. |

## Project Structure

```text
specs/255-scroll-highlight-plan-edit/
├── spec.md
├── plan.md
└── tasks.md

src/components/modules/PlanesAdminCRUD.tsx     # cambio puntual
src/components/modules/PlanesAdminCRUD.test.tsx  # test para SC-001/SC-002
```

**Structure Decision**: Option 1 (monolito Next.js). Cambio autocontenido en un componente cliente.

## Decisiones técnicas (para auditoría de ZEUS)

### Decisión 1 — Token para el resaltado
Se elige `bg-cielo/10` (Familia — pero aquí es cosmético de admin, no de puerta de entrada). Alternativa `bg-ambar/10` (admin backoffice) también válida — el criterio final queda a coherencia con otras tablas admin de la app. En la implementación, se elige la que ya use algún componente existente similar (ej. tablas de operadores) para no introducir un nuevo patrón visual.

### Decisión 2 — `scrollIntoView` con `behavior: "smooth"`
Se elige suave (respeta `prefers-reduced-motion` en navegadores modernos). Sin fallback JS explícito: la degradación es a scroll instantáneo, que sigue cumpliendo el objetivo.

## Complexity Tracking

Ninguna violación.
