# Feature Specification: SPEC-281 — Reparto de las 4 partes por peso medido (SC-002)

**Feature Branch**: `work/002-PI-velocidad-ci`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: cambia el mecanismo con que las 4 partes (shards) de `test-integration` se reparten los archivos de prueba. Hoy vitest usa `--shard=N/4` sobre el orden alfabético de archivos; se sustituye por una asignación explícita por duración medida. El número de shards (4) y el flujo del workflow no cambian.

**Input** (BRIEF-VELOCIDAD-DEL-CI §4.6 y §5.3, SC-002): la corrida `33000563200` mostró parte 1 = 14 m 37 s, parte 2 = 13 m 39 s, parte 4 = 13 m 18 s y **parte 3 = 29 m 48 s**. Tres partes terminaron en ~14 min y esperaron 16 min ociosas a la parte 3. La causa es que vitest reparte por orden alfabético de archivo y los archivos más caros (los 8 del §4.5) caen todos en la misma parte. Con solo balancear el reparto la corrida baja de ~30 min a ~15 min.

**Dependencias**: independiente de SPEC-280, SPEC-282 y SPEC-283. Es el segundo entregable del lote porque da el 40 % del beneficio total con riesgo bajo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Las 4 partes terminan en tiempos parecidos (Priority: P1)

Como responsable del CI quiero que las 4 partes de `test-integration` se repartan por peso medido y no por orden de archivo, para que ninguna quede ociosa 16 minutos esperando a otra.

**Independent Test**: en el primer PR con SPEC-281 mergeado, abrir un run del CI → las 4 partes deben terminar con menos de 3 minutos de diferencia entre la más rápida y la más lenta (SC-002).

**Acceptance Scenarios**:
1. **Given** el reparto por peso está activo, **When** corre `test-integration` en un PR con la línea base de pruebas actual, **Then** cada shard reporta duración en el rango `[T_min, T_min + 180s]` con `T_min = min(shard1..shard4)`.
2. **Given** un archivo de prueba nuevo se agrega sin datos de duración, **When** corre `test-integration`, **Then** ese archivo cae en el shard más liviano en ese momento y la corrida NO falla por asignación (fallback determinista).
3. **Given** el reparto por peso está activo, **When** cambia el orden alfabético de archivos (renombre de un archivo), **Then** la asignación de shards NO cambia (es función de la duración, no del nombre).

### Edge Cases

- ¿Y si el archivo de duraciones (`test-durations.json`) no existe o está corrupto? — se hace fallback al comportamiento actual de vitest (`--shard=N/4` puro) y se pinta `⚠️ reparto por orden alfabético (fallback)` en el summary del CI.
- ¿Y si un archivo aparece en `test-durations.json` pero ya no existe en el repo? — se ignora sin error.
- ¿Y si un archivo nuevo no tiene duración conocida? — se le asigna la mediana de las duraciones conocidas y se envía al shard actualmente más liviano.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir un archivo `test-durations.json` en la raíz del proyecto con el mapa `{ "src/foo/bar.test.ts": <segundos> }` para los archivos que corren en `test-integration`.
- **FR-002**: DEBE existir un script `scripts/ci/reparto-shards.mjs` que reciba `--shard N/4` y la ruta al `test-durations.json`, y emita por stdout la lista de archivos que le tocan a ese shard (uno por línea).
- **FR-003**: El algoritmo de reparto DEBE ser el greedy clásico de scheduling: ordenar archivos por duración descendente y asignar cada uno al shard que actualmente tiene la menor suma.
- **FR-004**: El paso de `test-integration` en `.github/workflows/ci.yml` DEBE cambiar de `--shard=${{ matrix.shard }}/4` a `--reporter=blob --outputFile.blob=blobs/shard-${{ matrix.shard }}.json $(node scripts/ci/reparto-shards.mjs --shard=${{ matrix.shard }}/4 --durations test-durations.json)`.
- **FR-005**: DEBE existir un script `scripts/ci/actualizar-duraciones.mjs` que, dado el JSON de vitest (`--reporter=json --outputFile=vitest-results.json`), actualice `test-durations.json` conservando el histórico (media móvil de las últimas 5 corridas para atenuar ruido).
- **FR-006**: El CI DEBE regenerar `test-durations.json` en el job agregador `test-integration-coverage` cuando la rama es `feature/001-scaffolding` (el equivalente a `main` del proyecto), commit-eándolo automáticamente con `[skip ci]` en el mensaje (o dejándolo como artifact que Fábrica commitea a mano si el bot no puede pushear).
- **FR-007**: Si `test-durations.json` NO existe o está vacío, el script cae al fallback de `--shard=N/4` puro y sale con exit 0 (no rompe CI el primer día).
- **FR-008**: NO se cambia el número de shards (4), ni el `pool: forks`, ni el `singleFork: false`, ni el `fileParallelism: false` de `vitest.config.ts`. El aislamiento se mantiene tal cual.

### Key Entities

- `test-durations.json` — mapa archivo → segundos (fuente única del reparto).
- `scripts/ci/reparto-shards.mjs` — algoritmo de reparto greedy.
- `scripts/ci/actualizar-duraciones.mjs` — actualiza el mapa tras cada corrida en la rama base.

## Success Criteria *(mandatory)*

- **SC-002 (brief)**: las 4 partes terminan con menos de 3 minutos de diferencia entre la más rápida y la más lenta. Hoy la diferencia es 16 minutos.
- **SC-281-A**: `test-durations.json` cubre al menos el 95 % de los archivos que corren en `test-integration` tras la primera actualización automática.
- **SC-281-B**: el reparto es determinista: dos ejecuciones del script con el mismo `test-durations.json` producen la misma asignación.

## Assumptions

- La rama base del proyecto es `feature/001-scaffolding` (D-051, D-82). El commit automático de `test-durations.json` va contra esa rama.
- Vitest 3.x acepta lista de archivos como positional args (`vitest run file1.test.ts file2.test.ts`); ya se usa así en scripts locales.
- La media móvil de 5 corridas es suficiente para amortiguar ruido de runners de GitHub (medido empíricamente en el brief §4.1).
