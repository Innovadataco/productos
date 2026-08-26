# Implementation Plan: SPEC-254 — Contrato de precio en COP

**Branch**: `work/002-PI-rescate-pagos` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Relajar `precioBaseUSD` en los dos esquemas Zod de planes (Create y Update) de `.positive()` a `.min(0).optional()` para que el `0` que envía la interfaz sea aceptado — sin tocar el `refine` de negocio y sin migración. Añadir dos tests que ejercitan el cuerpo real (contrato-driven, no valores inventados) para cerrar el patrón que dejó pasar I-126 en verde durante meses.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node.js ≥22
**Primary Dependencies**: Zod, Next.js 16 App Router, Vitest
**Storage**: PostgreSQL 16 (sin migración, sin cambio de esquema)
**Testing**: Vitest (`src/lib/schemas/pagos.test.ts` existente + `src/app/api/admin/pagos/planes/route.test.ts` existente)
**Target Platform**: server-side Node
**Project Type**: web-service (monolito Next.js, Option 1)
**Performance Goals**: N/A (cambio de validación)
**Constraints**: Cero migración, cero cambio de UI, cero cambio de contrato de datos (solo se relaja).
**Scale/Scope**: 2 líneas de `src/lib/schemas/pagos.ts` + 2 tests nuevos.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| §3.1 TS strict, sin `any` | ✅ | Cambio Zod puro. |
| §4.5 Migraciones aditivas | ✅ | Ninguna migración. |
| Candado motor IA (`src/lib/ai/**`) | ✅ | No se toca. |
| Frontera DAL (Q-3) | ✅ | No se toca. |

## Project Structure

```text
specs/254-contrato-precio-cop/
├── spec.md
├── plan.md
├── tasks.md         (Fase 2)
└── contracts/
    └── planes.md    (contrato tras el fix)

src/lib/schemas/pagos.ts                       # 2 líneas cambian (:56, :73)
src/app/api/admin/pagos/planes/route.test.ts    # test SC-011 add
src/app/api/admin/pagos/planes/[id]/route.test.ts  # test SC-011 análogo (PATCH)
```

**Structure Decision**: Option 1 (monolito Next.js). Cambio puntual, tests colocados junto al `route.ts` correspondiente.

## Decisiones técnicas (para auditoría de ZEUS)

### Decisión 1 — `precioBaseUSD` opcional, no obligatorio
Se hace `.optional()` (en vez de solo relajar a `.min(0)`) para que la interfaz pueda dejar de enviarlo cuando el CEO no cotice en dólares. Compatible con el patrón actual (donde llega `0` porque la interfaz siempre lo envía) — `optional()` no fuerza al frontend a cambiar.

### Decisión 2 — Se conservan los tests históricos
Los tests que envían `precioBaseUSD: 10, 2, 5` siguen pasando (`.min(0)` los acepta) y quedan como cobertura del multi-moneda vivo. Se AÑADE el test con `precioBaseUSD: 0`. La lección de I-126 se codifica en SPEC-260 (SC-010 tests de humo por pantalla), no eliminando la cobertura previa.

## Complexity Tracking

Ninguna violación.
