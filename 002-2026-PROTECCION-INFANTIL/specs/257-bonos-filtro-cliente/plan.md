# Implementation Plan: SPEC-257 — Filtro de bonos a componente cliente

**Branch**: `work/002-PI-rescate-pagos` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Extraer el `<form>+<select>` con `onChange` del Server Component `bonos/page.tsx` a un componente `"use client"` (`FiltroBonos.tsx`) — arregla el error de App Router y no cambia UX.

## Technical Context

**Language/Version**: TypeScript 5, React 19
**Primary Dependencies**: Next.js 16 App Router
**Storage**: N/A
**Testing**: Vitest + Testing Library
**Target Platform**: browser (client component)
**Project Type**: web-service
**Performance Goals**: sin impacto
**Constraints**: solo tokens; cero color crudo.
**Scale/Scope**: 1 archivo nuevo, 1 archivo editado.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| §3.1 TS strict | ✅ | props tipadas. |
| Candado motor IA | ✅ | No aplica. |
| SPEC-157 tokens | ✅ | El select usa tokens ya presentes. |

## Project Structure

```text
specs/257-bonos-filtro-cliente/
├── spec.md
├── plan.md
└── tasks.md

src/components/modules/pagos/FiltroBonos.tsx     # nuevo
src/app/dashboard/admin/pagos/bonos/page.tsx     # importa <FiltroBonos>
```

**Structure Decision**: Option 1. Componente cliente sigue el patrón de `PlanesAdminCRUD` (client) + `page.tsx` (server) usado en otros paneles.

## Decisiones técnicas (para auditoría de ZEUS)

### Decisión 1 — Auto-submit por JS con fallback nativo
El `onChange` del `<select>` llama `form.submit()`. Si el usuario tiene JS desactivado (raro pero posible), un botón "Filtrar" a la derecha del select cumple lo mismo (patrón progressive enhancement). Alternativa descartada: leer con `router.push()` — introduciría dependencia de `next/navigation` sin beneficio, la navegación GET convencional basta.

### Decisión 2 — Los props exponen valores actuales, no state
`<FiltroBonos activoActual={activo} origenActual={origen} />` — el estado vive en el URL (query string), el componente cliente lo refleja como valor por defecto del select. No introduce `useState`.

## Complexity Tracking

Ninguna violación.
