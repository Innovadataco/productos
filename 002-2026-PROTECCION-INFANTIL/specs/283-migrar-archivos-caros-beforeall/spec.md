# Feature Specification: SPEC-283 — Migrar los 8 archivos más caros a `beforeAll` + reset selectivo (SC-001, SC-003, SC-004, SC-009)

**Feature Branch**: `work/002-PI-velocidad-ci`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: no cambia el código de producto. En cada uno de los 8 archivos de prueba más caros (BRIEF §4.5) se sustituye el `beforeEach(resetDatabase)` por `beforeAll(resetDatabase(<lista de tablas mínima>))` cuando el archivo aísla su estado entre pruebas. En los archivos donde NO se puede, se conserva `beforeEach` y se documenta el motivo en una línea (SC-008). Requiere SPEC-282 mergeado.

**Input** (BRIEF-VELOCIDAD-DEL-CI §4.5, §5.1, §6/SC-001..SC-004, SC-008, SC-009): tres archivos con UNA sola prueba tardan ~50 s cada uno (colegio-resumen, carga/confirmar, embedding). Cinco archivos con pocas pruebas tardan 60–100 s (aplicar-bono, alertas, digest-semanal, avisos-observacion, resend/webhooks). Bajar estos 8 a limpieza por archivo + tablas mínimas cierra la brecha de tiempo del brief. **Es el SPEC de riesgo real del lote**: compartir estado entre pruebas puede introducir intermitencias. Por eso lleva **triple corrida obligatoria** antes de REALIZADO.

**Dependencias**: consume SPEC-282 (habilita `resetDatabase(tablas)`). Independiente de SPEC-280 y SPEC-281. **Es el 4º y último SPEC del lote.** Si al llegar aquí el tiempo aprieta, se para en SPEC-281 y se entrega igual (candado de Jelkin §2 del INSTRUCTIVO).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Los 3 archivos de una sola prueba bajan de ~50 s a < 10 s (Priority: P1)

Como responsable del CI quiero que `colegio-resumen.test.ts`, `api/colegio/carga/confirmar/route.test.ts` y `lib/dal/repositories/embedding.test.ts` (una prueba cada uno) reduzcan su tiempo por archivo de ~50 s a < 10 s.

**Independent Test**: correr cada archivo aislado 3 veces → duración < 10 s y el test pasa las 3 veces.

**Acceptance Scenarios**:
1. **Given** el archivo `lib/dal/repositories/colegio-resumen.test.ts` migrado a `beforeAll + resetDatabase(<tablas mínimas>)`, **When** se corre 3 veces seguidas, **Then** las 3 corridas pasan en < 10 s cada una y el resultado del test es idéntico.
2. **Given** los tres archivos migrados, **When** se corre `test-integration` completo 3 veces, **Then** los 3 archivos aparecen con duración < 10 s cada uno en el resumen de SPEC-280 en las 3 corridas.

### User Story 2 — Los 5 archivos multi-prueba bajan proporcionalmente (Priority: P1)

Como responsable del CI quiero que `aplicar-bono/route.test.ts` (6 pruebas → 99 s hoy) baje a < 24 s (< 4 s por prueba, SC-004 del brief), y equivalentes en los otros 4 archivos multi-prueba.

**Acceptance Scenarios**:
1. **Given** `api/pagos/aplicar-bono/route.test.ts` migrado, **When** se corre 3 veces seguidas, **Then** duración total < 24 s y todos los tests pasan las 3 veces.
2. **Given** un archivo donde NO se puede migrar (pruebas que se contaminan entre sí), **When** Fábrica audita el diff, **Then** el archivo lleva una línea explicando por qué no se migró (SC-008).

### User Story 3 — Cero intermitencias (Priority: P1) — SC-009

**Independent Test**: correr la suite completa `test-integration` **3 veces seguidas en LOCAL** tras el último commit del SPEC → los 3 resultados son idénticos (mismos tests pasan, mismos fallan, mismo total).

**Acceptance Scenarios**:
1. **Given** los 8 archivos migrados, **When** se corre `npm run test:integration` 3 veces seguidas, **Then** el número de tests pasados es el mismo en las 3 corridas y NINGÚN test aparece como flaky (verde en 1 y rojo en otra).
2. **Given** que una prueba aparece intermitente tras la migración, **When** se detecta, **Then** ese archivo se REVIERTE a `beforeEach + resetDatabase()` sin argumentos y se agrega la línea documentando el motivo (SC-008).

### Edge Cases

- ¿Y si dos pruebas del mismo archivo escriben la MISMA fila (colisión de unique)? — el archivo NO se migra; queda en `beforeEach`. Se documenta.
- ¿Y si una prueba requiere una tabla que otra NO usa? — la lista de tablas de `beforeAll` es la UNIÓN de las tablas que tocan todas las pruebas del archivo.
- ¿Y si el archivo mockea `verifyAuth` en `beforeEach`? — el mock puede migrarse a `beforeAll` con `vi.spyOn` restaurado en `afterAll`. La política de I-55 (no mockear Prisma) sigue vigente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBEN migrarse los 8 archivos del BRIEF §4.5 en el ORDEN indicado ahí (los 3 de UNA prueba primero, para ahorro rápido y validación del patrón).
- **FR-002**: Cada archivo migrado DEBE sustituir `beforeEach(async () => resetDatabase())` por `beforeAll(async () => await resetDatabase([...tablas mínimas]))`.
- **FR-003**: La lista `[...tablas mínimas]` DEBE ser la unión de las tablas efectivamente escritas o leídas por las pruebas del archivo (se determina leyendo el archivo, no adivinando).
- **FR-004**: Si un archivo tiene pruebas que se contaminan entre sí (comparten filas, se pisan estado), DEBE conservar `beforeEach` **y** llevar un comentario `// SPEC-283: reset por prueba porque <razón concreta>` (SC-008).
- **FR-005**: DEBE correrse la suite completa **3 veces seguidas** en local antes de dar por REALIZADO el SPEC. Los 3 resultados deben ser IDÉNTICOS. El comando y su salida se pega en el mensaje de commit del cierre.
- **FR-006**: Si aparece una intermitencia, el archivo culpable DEBE revertirse a `beforeEach + resetDatabase()` sin argumentos y documentarse en una línea la razón por la que no se pudo migrar.
- **FR-007**: NO se toca la lógica de negocio de las pruebas: los `it(..., ...)` y sus assertions quedan idénticos. Solo cambia el mecanismo de reset.
- **FR-008**: NO se cambia el número de pruebas (SC-005): si un archivo tenía N pruebas antes, tiene N pruebas después.
- **FR-009**: Los 8 archivos migrados DEBEN aparecer en el resumen de SPEC-280 con duraciones nuevas medidas. La comparación antes/después se reporta en el mensaje de REALIZADO.

### Key Entities

Los 8 archivos son:
- `src/app/api/pagos/aplicar-bono/route.test.ts` (6 tests, 99 s → objetivo < 24 s)
- `src/app/api/colegio/alertas/route.test.ts` (15 tests, 98 s → objetivo < 30 s)
- `src/lib/analisis/digest-semanal.test.ts` (40 tests, 67 s → probablemente ya está bien, revisar)
- `src/lib/colegio/avisos-observacion.test.ts` (4 tests, 62 s → objetivo < 16 s)
- `src/app/api/webhooks/resend/route.test.ts` (9 tests, 61 s → objetivo < 20 s)
- `src/lib/dal/repositories/colegio-resumen.test.ts` (1 test, 52 s → objetivo < 10 s)
- `src/app/api/colegio/carga/confirmar/route.test.ts` (1 test, 51 s → objetivo < 10 s)
- `src/lib/dal/repositories/embedding.test.ts` (1 test, 49 s → objetivo < 10 s)

## Success Criteria *(mandatory)*

- **SC-001 (brief)**: la corrida completa del CI baja de ~19 min de promedio a ≤ 10 min.
- **SC-003 (brief)**: los 3 archivos de una sola prueba bajan de ~50 s a < 10 s cada uno.
- **SC-004 (brief)**: `aplicar-bono/route.test.ts` baja de 16,5 s por prueba a < 4 s.
- **SC-005 (brief)**: el número total de pruebas de la suite NO baja tras el merge.
- **SC-006 (brief)**: la cobertura NO baja del piso vigente (36 % líneas / 49 % funciones).
- **SC-008 (brief)**: cada archivo donde NO se pudo migrar lleva una línea explicando por qué.
- **SC-009 (brief)**: ⭐ triple corrida idéntica antes de REALIZADO.

## Assumptions

- Las pruebas de los 8 archivos SÍ están aisladas entre sí en la mayoría de los casos (usan IDs generados con `Date.now()`, emails únicos, etc.). Los que no, quedan documentados en SC-008.
- `resetDatabase(tablas)` de SPEC-282 está mergeado y estable antes de arrancar este SPEC.
- La política del proyecto NO permite mockear el singleton de Prisma (I-55/SPEC-174); todas las pruebas siguen usando la BD real.
