# Feature Specification: SPEC-174 — Aislamiento estricto de tests (fix I-55)

**Feature Branch**: `work/002-pi-nocturno-20260817`

**Created**: 2026-08-17

**Status**: PLANEADO

Impacto en arquitectura: cambia la configuración de ejecución de la suite de integración (`vitest.config.ts`: `singleFork` true→false), simplifica `src/lib/test-setup.ts`, reintroduce los 7 archivos excluidos en el corte I-55, restaura `test-integration` como job bloqueante del gate de CI y añade una regla de arquitectura contra mocks del singleton de Prisma.

**Input**: Tarea nocturna 2026-08-17, Bloque 2. Contexto: el leak I-54 recurrente (`client.parametroSistema.findUnique is not a function`, order-dependent, solo CI-Linux) forzó dos cortes: exclusión de 7 archivos víctima (63b59c7c) y `test-integration` no bloqueante (75f9aa6b). La causa de fondo: con `singleFork:true` todos los archivos comparten un proceso y el estado de módulos (spies sobre el singleton de Prisma, `vi.mock` parciales) se filtra entre archivos. Esta spec cierra el fondo con aislamiento estricto por archivo y rehabilita el gate completo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cada archivo de test corre en su propio fork (Priority: P1)

Como equipo quiero que ningún archivo de test pueda contaminar a otro por estado de módulos, para que los flakes order-dependent dejen de existir por diseño y no por parches.

**Why this priority**: es la causa raíz de I-54/I-55; los parches (snapshot, canario, exclusiones) tratan síntomas.

**Independent Test**: correr `npm run test:integration` completo en orden nativo y con seeds barajados; los 7 archivos históricamente víctima pasan incluidos en la suite.

**Acceptance Scenarios**:

1. **Given** `vitest.config.ts` (project integration), **Then** `poolOptions.forks.singleFork` es `false` (cada archivo recibe un fork propio con su propio registro de módulos).
2. **Given** la suite completa de integración con los 7 archivos reintroducidos, **When** corre en local, **Then** está verde en orden nativo y en al menos 2 seeds barajados distintos.
3. **Given** el mutex `TestMutex`, **When** dos forks piden el lock a la vez, **Then** uno espera el turno (el aislamiento de BD se mantiene; ningún test corre concurrentemente contra la BD compartida).
4. **Given** `src/lib/test-setup.ts`, **Then** ya no contiene el registro `__prismaInstances`, el snapshot multi-instancia ni el canario (innecesarios con aislamiento por fork); la restauración básica de métodos se conserva como higiene intra-archivo.

---

### User Story 2 — El gate de CI vuelve a ser completo (Priority: P1)

Como equipo quiero que `test-integration` vuelva a ser bloqueante con los 7 archivos incluidos, para recuperar la cobertura real del gate sin excepciones.

**Why this priority**: los cortes I-55 dejaron el gate cojo; cerrar el fondo obliga a revertirlos en el mismo movimiento.

**Independent Test**: en el PR consolidado, el job `test-integration` corre los 211 archivos, sale verde y el job `gate` lo requiere.

**Acceptance Scenarios**:

1. **Given** `vitest.config.ts`, **Then** el bloque "EXCLUSIÓN TEMPORAL · I-55" con los 7 archivos ya no existe en `exclude`.
2. **Given** `.github/workflows/ci.yml`, **Then** `test-integration` no tiene `continue-on-error` y el job `gate` lo incluye en `needs`.
3. **Given** el CI del PR, **When** termina, **Then** los 5 jobs están verdes (verificaciones, test-unit, test-integration, journeys, build, gate).

---

### User Story 3 — Una regla impide reintroducir mocks del singleton de Prisma (Priority: P2)

Como equipo quiero que `arch:check` rechace `vi.spyOn(prisma.…)` y `vi.mock("…/prisma", …)` en archivos de test, para que el patrón que causó I-54 no pueda volver sin una decisión explícita.

**Why this priority**: con el aislamiento por fork el leak ya no cruza archivos, pero la regla evita deuda futura y documenta la excepción legítima.

**Independent Test**: introducir un `vi.spyOn(prisma.reporte, "findMany")` en un test cualquiera y verificar que `npm run arch:check` falla nombrando el archivo.

**Acceptance Scenarios**:

1. **Given** `npm run arch:check`, **Then** incluye una verificación nueva que escanea `src/**/*.test.ts(x)` y falla si encuentra `vi.spyOn(prisma.` o `vi.mock` del módulo prisma fuera de la allowlist.
2. **Given** la allowlist, **Then** contiene únicamente `src/lib/dal/services/circulo-confianza-n1.test.ts` (Proxy transparente legítimo para conteo de queries, con `importOriginal` + `unmockPrisma` en afterAll).
3. **Given** los tests que hoy espían métodos de Prisma (ej. `rate-limit.test.ts`), **When** la regla entra en vigor, **Then** esos tests fueron refactorizados para no espiar el singleton (spy sobre funciones propias del módulo bajo prueba, o cliente falso inyectado) y siguen verdes.

---

### Edge Cases

- Un fork muere a mitad de archivo (crash): el lock queda huérfano; la lógica existente de `TestMutex` (detección por reloj de BD) lo libera.
- Tests que legítimamente necesitan contar queries (N+1): solo vía la allowlist documentada.
- El proyecto `unit` de Vitest: no se toca (ya corre aislado por archivo y sin BD).
- Cobertura: los thresholds por proyecto se mantienen; reintroducir 7 archivos no baja los pisos (el ratchet solo sube).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `vitest.config.ts` (integration) DEBE ejecutar cada archivo en su propio fork (`singleFork: false`), conservando `fileParallelism: false` (un archivo a la vez) y `sequence.concurrent: false`.
- **FR-002**: El mutex `TestMutex` DEBE seguir serializando el acceso a la BD entre forks; ningún test corre concurrentemente contra la BD compartida.
- **FR-003**: `src/lib/test-setup.ts` DEBE simplificarse: fuera `__prismaInstances`, snapshot multi-instancia y canario; se conserva la restauración básica de métodos del singleton como higiene intra-archivo.
- **FR-004**: Los 7 archivos víctima (`apelaciones/route`, `apelaciones/[id]/documento`, `ia/rubrica/route`, `ia/rubrica/config`, `ia/rubrica/preguntas`, `permisos-modulos/route`, `reportes/route-atomicidad`) DEBEN volver a la suite de integración.
- **FR-005**: `.github/workflows/ci.yml` DEBE quitar `continue-on-error` de `test-integration` y reincluirlo en `gate.needs`.
- **FR-006**: `arch:check` DEBE incluir la regla anti-mocks de Prisma con allowlist explícita de un solo archivo.
- **FR-007**: Los tests que hoy violan la regla (spy sobre `prisma.*`) DEBEN refactorizarse para no hacerlo, manteniendo su cobertura.
- **FR-008**: La suite `test:integration` local DEBE cerrar verde con los 7 archivos incluidos, en orden nativo y en ≥2 seeds barajados.

### Key Entities

- **Fork de Vitest**: proceso aislado por archivo de test; su registro de módulos no se comparte.
- **TestMutex**: lock en PostgreSQL que serializa tests entre procesos (reloj de BD para huérfanos).
- **Allowlist**: lista explícita de excepciones a la regla anti-mocks (un archivo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run test:integration` local verde con 211/211 archivos (7 reintroducidos), 3 corridas consecutivas + 2 seeds barajados.
- **SC-002**: CI del PR consolidado con los 5 jobs + gate verdes; `test-integration` bloqueante.
- **SC-003**: `npm run arch:check` falla al introducir un `vi.spyOn(prisma.` de prueba y pasa con la allowlist intacta.
- **SC-004**: Cero ocurrencias de `vi.spyOn(prisma.` en `src/**/*.test.ts(x)` fuera de la allowlist.
- **SC-005**: Wall-clock de `test-integration` no supera el doble del valor anterior (~26 min → límite 50 min; esperado similar o menor al no compartir proceso).

## Assumptions

- `pool: "forks"` de Vitest aísla cada archivo en su propio proceso por defecto cuando `singleFork: false` (isolate por archivo); no requiere flags adicionales.
- El mutex por test hace innecesario paralelizar archivos; se mantiene `fileParallelism: false` para estabilidad de tiempos y cobertura.
- La restauración básica de métodos en `test-setup.ts` (higiene intra-archivo) no se elimina: protege tests que espían dentro del mismo archivo.
- `circulo-confianza-n1.test.ts` es la única excepción legítima (cuenta queries N+1 con Proxy + `importOriginal` + `unmockPrisma`).
- El fix multi-instancia y el canario (3f9e4ede) se retiran del setup pero quedan en la historia de git como referencia del incidente I-55.
