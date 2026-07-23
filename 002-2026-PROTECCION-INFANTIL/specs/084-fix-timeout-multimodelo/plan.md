# Implementation Plan: Spec 084 — Fix timeout multi-modelo (I-07)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

## Summary

Un solo cambio funcional: en `runSimulacionBatchCreator` (`src/lib/simulacion/executor.ts`), el update que pone la run en `EN_PROGRESO` también fija `fechaInicio: new Date()`. Así el timeout (que ya mide desde `fechaInicio` en `progreso.ts`) se ancla al arranque real de cada run y no a la creación del lote. `createdAt` intacto. Sin migración.

## Technical Context

**Language/Version**: TypeScript 5 (strict)
**Storage**: PostgreSQL — sin cambios de esquema
**Testing**: Vitest (executor: assert de `fechaInicio` en el update EN_PROGRESO; progreso: timeout no dispara con `fechaInicio` reciente aunque la creación sea vieja — el hueco multi-modelo) + validación en vivo con lote de 3 modelos
**Constraints**: sin migración; cambio mínimo.

## Constitution Check

Sin violaciones: fix acotado, Spec Kit cumplido, IA local intacta.

## Diseño

### Cambio único — `src/lib/simulacion/executor.ts`

```ts
await prisma.simulacionRun.update({
    where: { id: runId },
    data: { estado: "EN_PROGRESO", fechaInicio: new Date() },
});
```

(El update ya existe en `runSimulacionBatchCreator`; se añade `fechaInicio`.)

### Tests

1. `executor.test.ts`: el update a `EN_PROGRESO` incluye `fechaInicio` tipo Date (y ≈ now).
2. `progreso.test.ts` (hueco multi-modelo): run con `createdAt`/`fechaInicio` de creación antigua PERO `fechaInicio` (arranque) reciente → NO cae en FALLIDA; y run con `fechaInicio` antiguo → FALLIDA (ya cubierto por el test de timeout existente; se añade el caso "arranque reciente, creación antigua").

### Validación en vivo

Lote de 3 modelos (p. ej. ornith:9b, qwen2.5:14b, llama-guard3:8b) × 50 casos:
- SQL: `createdAt`, `fechaInicio`, `fechaFin`, `estado` por run → `fechaInicio(run N+1) > fechaFin(run N)` (o ≈ arranque propio) y `fechaInicio(run2/3) > createdAt`.
- Ninguna run FALLIDA por reloj del lote.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Reintento del batch resetea el reloj | Aceptable: la creación es reanudable; la run sigue midiendo su propio procesamiento. |
| Runs EN_PROGRESO históricas | Se cierran por timeout con el reloj viejo (ya documentado en 083). |

## Plan de ejecución

1. Fix executor + 2 tests.
2. Gate estático (lint/tsc) + suite.
3. `dev-restart.sh` (worker con el fix).
4. Lote de 3 modelos × 50 casos; verificación SQL de fechas y estados.
5. Docs cierre + índice + commit: `fix(simulacion): timeout por arranque propio de cada run (spec 084, I-07)`.
