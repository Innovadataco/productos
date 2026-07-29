# Spec 123 — Motor: tipos desde Prisma, código muerto y guardas unificadas

- **Status**: FINALIZADO
- **Bloque**: 002-PI-041 FASE 3 / R5 — "Motor: lo seguro, y solo lo seguro"
- **Alcance**: `src/lib/ai/**`, tipos y código muerto en `src/lib/**`. NO rutas API, NO componentes, NO motor (rúbrica, terna de modelos, umbral 60%, `ia.rubrica.enabled`).

## Objetivo

Saneamiento seguro alrededor del motor de clasificación, sin cambiar una sola
decisión de clasificación en producción:

1. Eliminar tipos manuales redundantes que ensombrecen los enums de `@prisma/client`.
2. Podar código muerto verificado (cero importadores, evidencia grep en cada commit).
3. Unificar las tres copias divergentes de las guardas de seguridad
   (spam/ráfaga/keywords/doxing): la de **producción es la referencia** y las otras
   dos la adoptan.

## User Stories

### US1 — Tipos desde Prisma (Priority: P1)

Como mantenedor, quiero que `src/lib/ai/classifier.ts` use los enums generados por
Prisma en vez de uniones redefinidas a mano, para que un cambio de esquema no
diverja silenciosamente.

**Acceptance Scenarios**

1. `CategoriaConducta` y `EstadoReporte` en `classifier.ts` provienen de `@prisma/client`.
2. Los miembros manuales eran idénticos al enum (verificado contra `prisma/schema.prisma`).
3. `npx tsc --noEmit` y los tests del clasificador pasan sin cambios de comportamiento.

### US2 — Código muerto podado (Priority: P2)

Como mantenedor, quiero eliminar exports sin ningún importador, con evidencia de
búsqueda por poda, para reducir superficie muerta alrededor del motor.

**Acceptance Scenarios**

1. Cada poda va en su propio commit con la evidencia grep en el mensaje.
2. Lo que solo está vivo por un test se poda junto con ese test (ajustándolo a la
   variante viva, sin ablandar aserciones).
3. `ReporteStepUbicacion.tsx` se verifica como muerto pero NO se poda (fuera de
   alcance: es componente); se reporta a ZEUS.

### US3 — Guardas unificadas adoptando producción (Priority: P1)

Como mantenedor, quiero que sandbox y eval-runner apliquen exactamente la lógica de
guardas de producción (`aplicarGuardasSeguridad`), para que las simulaciones y
evaluaciones decidan lo mismo que el pipeline real.

**Acceptance Scenarios**

1. Existe un módulo puro compartido en `src/lib/ai/` cuya salida es idéntica a la de
   `src/app/api/reportes/procesar/helpers/guardas.ts` (demostrado con test de paridad).
2. `src/app/api/reportes/procesar/helpers/guardas.ts` NO se modifica (diff vacío).
3. Sandbox y eval-runner adoptan la lógica completa, incluida la rama spam/ráfaga,
   con `esRafaga=false` en sus contextos.
4. Test de paridad con fixtures: mismas decisiones (estadoFinal, prioridadAlta,
   keywordsDetectadas) entre el módulo compartido y el helper de producción.

## Functional Requirements

- FR-001: El sistema DEBE reemplazar los tipos manuales `CategoriaConducta` y
  `EstadoReporte` de `src/lib/ai/classifier.ts` por los de `@prisma/client`.
- FR-002: El sistema NO DEBE unificar tipos manuales que diverjan del esquema; se
  anotan para ZEUS (p. ej. `CATEGORIAS_EVAL` sin `SPAM` en `eval-runner.ts`).
- FR-003: Cada poda DEBE tener cero importadores verificados, incluidos imports
  dinámicos en `scripts/*.mjs` (el worker importa `eval-runner` y los backfills
  dinámicamente).
- FR-004: La unificación de guardas NO DEBE tocar el helper de producción ni cambiar
  sus decisiones; si lo hiciera, se detiene y se anota.
- FR-005: El `classificationResponseSchema` de `src/lib/ai/schemas.ts` NO se toca:
  alimenta el prompt del modelo (motor).

## Success Criteria

- `tsc`, `lint`, tests tocados y build verdes bajo candado; suite completa una vez al final.
- Diff vacío en `src/app/api/**` y `src/components/**`.
- Test de paridad guardas: decisiones idénticas módulo compartido vs producción.

## Assumptions

- Las dos copias no-productivas que adoptan son `src/lib/ai/sandbox.ts` y
  `src/lib/ai/eval-runner.ts`. Los harnesses históricos `scripts/eval-classifier-f3..f6.ts`
  (solo guarda doxing, ligados a fixes F3–F6) NO son la tercera copia: se anotan, no se tocan.
- `guardas-previas.ts` (spec 092) es un pre-filtro distinto, no una copia: no se toca.

## Implementación

- **b)** commit 50e502b1 — `classifier.ts` usa `CategoriaConducta`/`EstadoReporte`
  de `@prisma/client` (eran uniones idénticas al esquema, verificado).
- **c)** commits a456256f (`getDefaultOllamaBaseUrl`) y 91dcabf2 (`llamarOllama` +
  ajuste de su test) — podas con evidencia grep de cero importadores en los
  mensajes. `ReporteStepUbicacion.tsx` verificado muerto pero no podado (fuera de
  alcance) → ZEUS.
- **d)** commit 6ecd18f2 — nuevo `src/lib/ai/guardas-decision.ts` (réplica pura de
  producción) adoptado por `sandbox.ts` y `eval-runner.ts`; producción intacta;
  paridad y antes/después demostrados en `guardas-decision.test.ts` (44 tests).
- Gate y evidencia completa en `cierre.md`.
