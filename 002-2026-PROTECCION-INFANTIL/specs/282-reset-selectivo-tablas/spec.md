# Feature Specification: SPEC-282 — `resetDatabase()` selectivo por tablas (SC-004)

**Feature Branch**: `work/002-PI-velocidad-ci`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: se añade una segunda firma opcional a `resetDatabase()` en `src/lib/test-utils.ts`: además de la forma sin argumentos (comportamiento actual: vacía las 96 tablas), acepta un array de nombres de tabla explícito y vacía solo ese subconjunto. **No migra ningún archivo de prueba todavía** — solo habilita el mecanismo. La adopción es de SPEC-283.

**Input** (BRIEF-VELOCIDAD-DEL-CI §5.2 y §6/SC-004): `resetDatabase()` vacía 96 tablas por llamada. El archivo `api/pagos/aplicar-bono/route.test.ts` tarda 16,5 s por prueba principalmente porque cada `beforeEach` paga el costo fijo del TRUNCATE de 96 tablas cuando el test solo toca ~6. El costo es fijo por llamada; se diluye con muchas pruebas por archivo (`digest-semanal.test.ts` con 40 pruebas → 1,7 s por prueba), pero explota con archivos de pocas pruebas. Vaciar solo las tablas necesarias baja el costo por llamada de ~800 ms a < 100 ms.

**Dependencias**: independiente de SPEC-280 y SPEC-281. SPEC-283 la consume. **No romper archivos existentes es el candado principal**: la forma sin argumentos debe seguir vaciando las 96 tablas exactamente como hoy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Un archivo de prueba puede pedir limpiar solo lo que usa (Priority: P1)

Como autor de un test de integración quiero poder decir `await resetDatabase(["Usuario", "Reporte"])` para que se vacíen solo esas dos tablas, en vez de las 96.

**Independent Test**: correr `src/lib/test-utils.test.ts` (nuevo) → los 4 casos pasan.

**Acceptance Scenarios**:
1. **Given** `resetDatabase()` sin argumentos, **When** se llama, **Then** vacía las 96 tablas EXACTAS que vacía hoy (comportamiento actual, sin cambios).
2. **Given** `resetDatabase(["Usuario", "Reporte"])`, **When** se llama, **Then** vacía solo esas 2 tablas (más las que dependan por CASCADE) y NO toca las otras 94.
3. **Given** `resetDatabase(["TablaQueNoExiste"])`, **When** se llama, **Then** lanza error explícito `"Tabla no encontrada en pg_tables: TablaQueNoExiste"` (no hace TRUNCATE parcial silencioso).
4. **Given** `resetDatabase([])` (array vacío), **When** se llama, **Then** NO hace TRUNCATE de nada, pero SÍ ejecuta `otorgarTodosLosPermisos()` y `asegurarPlataformas()` (mantiene la parte de seed).

### Edge Cases

- ¿Y si el llamante pasa una tabla EXCLUIDA (`Pais`, `Departamento`, `Ciudad`, `Plataforma`, `_prisma_migrations`, `TestMutex`)? — se ignora silenciosamente con warning por stderr `[resetDatabase] tabla excluida ignorada: Pais`, para mantener el mismo comportamiento que la variante sin argumentos.
- ¿Y si el llamante pasa nombres con distinto casing (`usuario` vs `Usuario`)? — Postgres es case-sensitive con nombres entre comillas; se pasan tal cual llegan y `pg_tables` decide si existen. Si no, cae en el escenario 3.
- ¿Y si dos pruebas del mismo archivo llaman a `resetDatabase()` con listas distintas? — cada llamada se resuelve independientemente. No hay caché.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE modificarse la firma de `resetDatabase` en `src/lib/test-utils.ts` a `export async function resetDatabase(tablas?: string[]): Promise<void>`.
- **FR-002**: Si `tablas === undefined`, el comportamiento DEBE ser EXACTAMENTE el actual (leer `pg_tables`, filtrar `EXCLUDED_TABLES`, TRUNCATE de todas, seed).
- **FR-003**: Si `tablas === []`, DEBE saltarse el TRUNCATE completo y correr solo `otorgarTodosLosPermisos()` y `asegurarPlataformas()`.
- **FR-004**: Si `tablas` es un array con nombres, DEBE:
  - filtrar los que estén en `EXCLUDED_TABLES` (con warning por stderr).
  - validar contra `pg_tables` que existen; lanzar error si alguno no existe.
  - ejecutar UN SOLO `TRUNCATE TABLE "t1", "t2", ... CASCADE`.
  - correr `otorgarTodosLosPermisos()` y `asegurarPlataformas()` igual que la variante sin argumentos.
- **FR-005**: DEBE existir `src/lib/test-utils.test.ts` con los 4 acceptance scenarios como tests unitarios (usando la BD de test real, sin mocks — respeta la política del proyecto de I-55/SPEC-174).
- **FR-006**: NO se migra NINGÚN archivo de prueba en esta SPEC. Los 364 archivos que hoy llaman `resetDatabase()` sin argumentos siguen funcionando exactamente igual.
- **FR-007**: NO se cambia la lista de `EXCLUDED_TABLES`, ni `otorgarTodosLosPermisos()`, ni `asegurarPlataformas()`.

### Key Entities

- `src/lib/test-utils.ts` — firma extendida, cuerpo re-organizado en helpers puros.
- `src/lib/test-utils.test.ts` — nuevo archivo con los 4 tests.

## Success Criteria *(mandatory)*

- **SC-004 (brief)**: el nuevo mecanismo permite bajar `aplicar-bono/route.test.ts` de 16,5 s por prueba a < 4 s. Se mide en SPEC-283, pero la habilitación es SPEC-282.
- **SC-282-A**: los 4 tests de `src/lib/test-utils.test.ts` pasan en 3 corridas seguidas sin intermitencias.
- **SC-282-B**: el número total de pruebas de la suite integration NO baja tras el merge de SPEC-282 (verificado en el resumen de SPEC-280).

## Assumptions

- El TRUNCATE de una única tabla toma < 100 ms en Postgres 16 sobre un dataset vacío (medido empíricamente en el propio proyecto: los 96 truncados hoy tardan ~800 ms en total, → ~8 ms por tabla).
- `CASCADE` con lista explícita se comporta igual que con lista completa: cae por FKs pero solo dentro del subconjunto pedido más lo dependiente. Ese es el comportamiento deseado.
- Los tests del propio `test-utils.test.ts` NO reintroducen la fuga I-55: usan la BD real, no mocks de Prisma.
