# Implementation Plan: SPEC-136 — `as unknown as` ×29 + `!.` ×15 + tsconfig maximal viable (E-3)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/136-tipado-estricto-casts-guards-tsconfig/spec.md` (002-PI-056, E-3)

## Summary

Eliminar los 29 `as unknown as` (tipos reales: genéricos, guards sobre `unknown`,
`Prisma.*GetPayload`, Zod en el motor) y los 15 `!.` (guardas/narrowing con errores
controlados), y activar el tsconfig maximal VIABLE: `noFallthroughCasesInSwitch` (0
errores), `noImplicitOverride` (1), `forceConsistentCasingInFileNames`,
`exactOptionalPropertyTypes` (120 corregidos). Diferidos con conteo:
`noUncheckedIndexedAccess` (565) y `noPropertyAccessFromIndexSignature` (326).

## Technical Context

**Language/Version**: TypeScript 5 (strict → maximal viable), Node.js >= 22
**Primary Dependencies**: zod (motor), Prisma types. Nada nuevo.
**Storage**: N/A
**Testing**: Vitest — red existente sin tocar; los fixes de tipos no cambian runtime
**Project Type**: refactor de tipado (comportamiento preservado)
**Constraints**: reglas 1/2/7 del prompt único — cero tests tocados, defecto real →
PARAR, motor solo se tipa
**Scale/Scope**: 29 casts en 9 archivos, 15 `!.` en 9 archivos, ~121 errores de flags

## Constitution Check

- **TypeScript estricto (AGENTS.md)**: ES la spec — lleva el código a la disciplina
  declarada (prohibido `any`; casts con justificación).
- **No debilitar tests / motor intacto**: OK — tipos, no lógica.

Sin violaciones que justificar.

## Inventario verificado (2026-08-01)

### `as unknown as` (29)

| Archivo | N | Naturaleza probable |
|---|---|---|
| `dal/services/reporte-processing/clasificacion.ts` | 10 | JSON de Ollama → Zod/guards |
| `dal/services/ia-evals.ts` | 8 | payloads de eval → tipos del dominio |
| `colegio/pdf-estadisticas.ts` | 3 | pdfmake defs |
| `lib/test-setup.ts` | 2 | mocks de entorno |
| `dal/repositories/carga-roster-sesion.ts` | 2 | Json de Prisma → roster tipado |
| `ia-simulaciones.ts`, `ai/eval-runner.ts`, `prisma.ts`, `ui/GlassCard.tsx` | 4 | sueltos |

### `!.` (15)

`GestionPageClient.tsx` (5, mismo narrowing), `correcciones/route.ts` (2),
`configuracion.ts` (3), `simulaciones/route.ts`, `apelaciones/route.ts`,
`ConfigSection.tsx` (2), `riesgo-consulta.ts` (1).

### tsconfig (medido)

| Flag | Errores | Decisión |
|---|---|---|
| `noFallthroughCasesInSwitch` | 0 | ACTIVAR |
| `noImplicitOverride` | 1 | ACTIVAR |
| `forceConsistentCasingInFileNames` | 0 | ACTIVAR |
| `exactOptionalPropertyTypes` | 120 | ACTIVAR y corregir |
| `noPropertyAccessFromIndexSignature` | 326 | DIFERIR (spec aparte) |
| `noUncheckedIndexedAccess` | 565 | DIFERIR (spec aparte) |

## Data Model

N/A — no cambia schema ni entidades; es tipado del código existente.

## Contracts

N/A — no cambia ningún endpoint (los route tests afirman los mismos payloads; ojo con
`exactOptionalPropertyTypes` y `{ x: undefined }`).

## Fases de implementación (resumen para tasks)

1. **Casts del motor y DAL** (21): `clasificacion.ts` + `ia-evals.ts` +
   `ia-simulaciones.ts` + `eval-runner.ts` + `carga-roster-sesion.ts` → Zod/guards/
   GetPayload. Commit con suite del motor verde.
2. **Casts sueltos** (8): pdf-estadisticas, test-setup, prisma, GlassCard.
3. **`!.` → guardas** (15): narrowing compartido en GestionPageClient; guards con
   AppError en rutas/servicios.
4. **tsconfig**: activar los 4 flags, corregir los ~121 errores (la mayoría
   `exactOptionalPropertyTypes`: `?: T` vs `?: T | undefined`).
5. **Gates + cierre**: suite completa, tsc con flags nuevos, lint, build, arch:check.
