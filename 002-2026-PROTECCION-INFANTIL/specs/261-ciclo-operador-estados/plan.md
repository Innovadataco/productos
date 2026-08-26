# Implementation Plan: `ESTADOS_CARGA_OPERADOR` — SPEC-261

**Branch**: `work/002-PI-ciclo-operador` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0

---

## Summary

Extraer `ESTADOS_CARGA_OPERADOR = ["REVISION_MANUAL", "POSIBLE_SPAM"]` a un archivo único y reemplazar las 6 apariciones literales por su consumo. Habilita reasignar y escalar a comité un `POSIBLE_SPAM`. Sin migraciones. Sin cambios en `src/lib/ai/**`, `asignador.ts` ni `finalizacion.ts`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| Language/Version | TypeScript 5.x / Node.js >=22 |
| Primary Dependencies | Prisma 5.22.0, Next.js 16.2.10, Vitest, jsdom + Testing Library |
| Testing | Vitest (unit/integración) + tests de componente sobre `AdminReportesTable`, `panelAsignacion`, listado operadores |
| Constraints | Cero migraciones · cero cambios en `src/lib/ai/**` · cero cambios en `asignador.ts`/`finalizacion.ts` · frontera DAL intacta (Q-3) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | No toca multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No cambia la consulta pública |
| §2.1 Stack heredado | ✅ Pass | Reutiliza Prisma/Vitest |
| §3.1 TypeScript strict | ✅ Pass | Constante `as const`; tipo derivado de `EstadoReporte` |
| §3.2 Tipado Prisma dinámico | ✅ Pass | `Prisma.ReporteWhereInput` en todos los `where` |
| §3.4 Códigos HTTP | ✅ Pass | Mantiene 200/400/403/409 existentes |
| §4.2 Rutas API individuales | ✅ Pass | No agrega endpoints; extiende semántica de dos existentes |
| §5.1 Testing | ✅ Pass | Tests que abren componentes, no solo APIs |

---

## Implementation Steps

### Phase 1 — Fuente única
1. Crear `src/lib/operadores/estados.ts` con:
   ```ts
   import type { EstadoReporte } from "@prisma/client";
   export const ESTADOS_CARGA_OPERADOR: readonly EstadoReporte[] =
       ["REVISION_MANUAL", "POSIBLE_SPAM"] as const;
   ```
2. Añadir test `estados.test.ts` de tipo (`satisfies`) + snapshot del contenido para prevenir divergencia futura.

### Phase 2 — Refactor de las 6 superficies (fix por sitio, TDD por sitio)
3. `src/lib/dal/services/operadores.ts`
   - `listar()` línea 75 → `whereReporteEnEstados(ESTADOS_CARGA_OPERADOR, { operadorId: op.id })`.
   - `panelAsignacion()` líneas 363–365 → tres `whereReporteEnEstados(ESTADOS_CARGA_OPERADOR, …)`.
   - Test: `operadores.test.ts` cubre el caso "1 POSIBLE_SPAM sin asignar + 1 asignado" (SC-002).
4. `src/lib/operadores/reconciliacion-huerfanos.ts:27` → `estado: { in: ESTADOS_CARGA_OPERADOR }`.
   - Test: `reconciliacion-huerfanos.test.ts` cubre spam huérfano (SC-003).
5. `src/lib/operadores/reasignar-service.ts:39` → `if (!ESTADOS_CARGA_OPERADOR.includes(reporte.estado))`.
   - `AuditLog` de reasignación: `estadoAnterior/Nuevo = reporte.estado` (no literal). Test cubre SC-004.
6. `src/app/api/admin/reportes-revision/[id]/route.ts:78` → `puedeEscalar` con `ESTADOS_CARGA_OPERADOR.includes(reporte.estado)`.
   - Test de ruta: OPERADOR dueño de `POSIBLE_SPAM` obtiene `puedeEscalar: true`.
7. `src/app/api/admin/reportes/[id]/escalar/route.ts:88` → `if (!ESTADOS_CARGA_OPERADOR.includes(reporte.estado))` (mismo código 409, mensaje se generaliza a "Solo se pueden escalar casos en el ciclo del operador").
   - Test cubre SC-005.
8. Barrido D-37 (`grep -rn '"REVISION_MANUAL"' src/lib/dal/services/operadores.ts …`) para confirmar cero literales sobrevivientes en esos 6 archivos.

### Phase 3 — Tests que abren pantalla
9. `src/components/modules/AdminReportesTable.test.tsx`: con seed que devuelve un `POSIBLE_SPAM`, verificar que el filtro y el botón "Escalar" (delegado al detalle) no discriminan por estado.
10. Test de integración de `panelAsignacion` que compara conteos con literal previo — falla si algún literal reaparece.

### Phase 4 — Gate local
11. `npx tsc --noEmit`
12. `npm run lint`
13. `npm run test`
14. `npm run arch:check`
15. `npm run build`
16. `./scripts/dev-restart.sh` para deploy limpio (una vez integradas las 4 SPECs, se ejecuta al final).

---

## Risk & Rollback

- Riesgo bajo: el asignador ya considera ambos estados. El cambio propaga esa realidad al resto.
- Rollback: revertir el commit `fix(SPEC-261)` — todos los `where` vuelven al literal.

---

## Out of Scope

- Cambiar el motor IA, `asignador.ts` o `finalizacion.ts`.
- Rediseñar la bandeja del operador o el panel de spam.
- Alterar el comportamiento del denunciante (SPEC-031 anti-abuso).
