# Feature Specification: Guardián de índices (cierra I-49)

**Feature Branch**: `work/002-PI-154` (SPEC-251)
**SPEC**: 251
**Created**: 2026-08-26
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-154-GUARDIAN-INDICES-I49 · BRIEF-GUARDIAN-INDICES-I49 v1.1 · I-49 · D-72

Impacto en arquitectura: **cero cambios funcionales al motor** (`src/lib/ai/**` intacto). Se extiende `scripts/verify-hnsw-indexes.ts` (ya existe, cubre 2 de 5 índices, no está cableado) para convertirlo en el guardián de los 5 índices en riesgo, con verificación de tipo generalizada y detección de huérfanos. Se cablea a **tres compuertas**: CI (paso nuevo tras `prisma migrate deploy`), `scripts/deploy-prod.sh` (entre L27 `migrate deploy` y L41 `sync-modulos-grants`), y `pi-monitor` (probe nuevo con frecuencia parametrizable). Migración aditiva única: `monitoreo.indices.frecuencia_horas` (default 24) en `ParametroSistema`. Nuevo alias `indices:check` conservando `db:verify:hnsw`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — CI atrapa una migración destructiva de índice (Priority: P1)

ODIN abre un PR que, sin querer, deja un `DROP INDEX` sobre `Ciudad_nombreNormalizado_trgm_idx`. Tras aplicar migraciones en la BD de la CI, el paso `indices:check` corre y sale ≠ 0 con mensaje claro. El PR queda rojo y no se puede mergear.

**Why this priority**: I-49 se materializó en SPEC-145 exactamente por esto. Convertir la disciplina manual en compuerta automática cierra la deuda.

**Independent Test**: Correr `pnpm indices:check` contra una BD sin `Ciudad_nombreNormalizado_trgm_idx` → salida ≠ 0, mensaje nombra el índice y qué rompe.

**Acceptance Scenarios**:

1. **Given** una BD sin `Ciudad_nombreNormalizado_trgm_idx`, **When** corre `pnpm indices:check`, **Then** sale con código ≠ 0 y el log incluye `[INDICES] FALTA: Ciudad_nombreNormalizado_trgm_idx — rompe búsqueda de ciudades (I-45)`.
2. **Given** un PR que introduce un `DROP INDEX` sobre un índice esperado, **When** corre el workflow de CI, **Then** el paso `indices:check` falla y el PR queda rojo.
3. **Given** una BD sana, **When** corre `pnpm indices:check`, **Then** sale código 0 y lista los 5 índices como `OK`.

### User Story 2 — Deploy a producción se detiene si falta un índice (Priority: P1)

El CEO ejecuta `./scripts/deploy-prod.sh` en el VPS. Tras `prisma migrate deploy` la migración deja mal un índice HNSW (queda como `btree`). El guardián corre entre L27 y L41, detecta el tipo incorrecto, sale con error y el deploy se detiene **antes** de `sync-modulos-grants`. **No hace rollback automático**: el CEO decide.

**Why this priority**: Un motor IA sin sus índices HNSW se degrada silenciosamente. La compuerta de deploy es la última barrera antes de que el CEO lo note como "el motor se volvió lento".

**Independent Test**: En BD de prueba, transformar `EmbeddingReporte_vector_idx` de `hnsw` a `btree`; correr `pnpm indices:check` → sale ≠ 0 nombrando el tipo esperado y el encontrado.

**Acceptance Scenarios**:

1. **Given** un índice vectorial degradado a `btree`, **When** el deploy alcanza el paso del guardián, **Then** el deploy sale con error y **no** ejecuta `sync-modulos-grants`.
2. **Given** un índice esperado ausente en prod, **When** corre el deploy, **Then** el guardián para y muestra el nombre del índice, la tabla y qué función se degrada.
3. **Given** una prod sana, **When** corre el deploy, **Then** el guardián registra los 5 índices como presentes y el deploy continúa hasta `Listo`.
4. **Given** que el guardián falla, **Then** **no** se intenta rollback automático: el script termina con error y el CEO decide qué hacer.

### User Story 3 — Healthcheck de índices en pi-monitor (Priority: P2)

Un administrador ve en el tablero de monitoreo el estado del último chequeo de índices (fecha, verde/rojo, lista de faltantes) sin tener que abrir SSH ni consultar SQL. La frecuencia es parametrizable por `ParametroSistema` sin deploy.

**Why this priority**: Cubre el hueco entre despliegues. Un índice puede desaparecer por un `psql` manual del administrador o un dump/restore malhecho — la CI y el deploy no lo verán, el monitor sí.

**Independent Test**: Levantar `pi-monitor`, dejar que corra un tick con `monitoreo.indices.frecuencia_horas=0.01` (~36 s); verificar que aparece la señal `indices` con último resultado y timestamp en la tabla `HealthProbe`.

**Acceptance Scenarios**:

1. **Given** un valor de `monitoreo.indices.frecuencia_horas`, **When** transcurre el intervalo, **Then** `pi-monitor` corre el guardián y registra el resultado como una probe (verde/rojo).
2. **Given** un índice faltante en la BD, **When** el probe corre, **Then** aparece en rojo con la lista de faltantes; **nunca reinicia nada**.
3. **Given** que el CEO cambia `monitoreo.indices.frecuencia_horas` en `ParametroSistema`, **When** el monitor relee su config, **Then** la nueva frecuencia rige sin reiniciar.

### User Story 4 — Índice huérfano avisa sin romper el flujo (Priority: P2)

Alguien crea un índice nuevo por SQL crudo en una migración. Tras `migrate deploy`, `indices:check` detecta el huérfano y emite advertencia con instrucción de agregarlo a la lista declarada. Sale con código 0 — el huérfano puede ser legítimo y recién creado.

**Why this priority**: Fuerza la disciplina sin bloquear despliegues legítimos. Es el otro extremo del guardián: no solo "falta algo", también "hay algo que no reconozco".

**Independent Test**: Crear un índice de prueba en BD y correr `pnpm indices:check` → salida 0 + línea `[INDICES] HUÉRFANO: <nombre> — agrégalo a REQUIRED si es intencional`.

**Acceptance Scenarios**:

1. **Given** un índice presente en `pg_indexes` que no está en la lista declarada, **When** corre `pnpm indices:check`, **Then** aparece como HUÉRFANO en el log; salida sigue en 0.
2. **Given** que el huérfano se agrega a la lista `REQUIRED`, **When** vuelve a correr, **Then** ya no aparece como huérfano.

---

## Edge Cases

- **Nombre truncado**: el índice único de `patrones_institucionales` está truncado a 63 caracteres. La lista declara el nombre real (truncado), no el ideal, y el archivo lo documenta con un comentario para evitar que alguien lo "corrija".
- **`db:verify:hnsw` sigue vivo**: nada que hoy invoque `pnpm db:verify:hnsw` puede romperse — es alias de `indices:check` con el mismo exit code.
- **`--json`**: el flag emite el resultado en JSON estable para consumo por `pi-monitor` u otros scripts; humanos por defecto.
- **Sin BD alcanzable**: el guardián sale con error explícito distinguible (código 2) para que el deploy lo trate como error de infraestructura, no como índice faltante.
- **Concurrencia**: `pg_indexes` no bloquea; el guardián no toma locks. Puede correr en paralelo con tráfico de prod sin impacto.
- **Timeout**: presupuesto interno de 5 s (holgado sobre el objetivo <2 s). Si se agota, sale con error nombrando el timeout — no cuelga la CI ni el deploy.
- **Reintentos**: cero. Un fallo del guardián en deploy o CI se reporta y se para. La decisión humana es el mecanismo de recuperación (candado del brief §6).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mantener una constante `REQUIRED` con los 5 índices esperados: nombre real en BD, tabla, tipo (`btree`/`gin`/`hnsw`/`unique`), qué sostiene (una línea legible), y migración de origen. Los 5 son `Ciudad_nombreNormalizado_trgm_idx`, `EmbeddingDataset_vector_idx`, `EmbeddingReporte_vector_idx`, `AlertaColegio_patronInstitucionalId_idx` y el único truncado de `patrones_institucionales`.
- **FR-002**: El comando `pnpm indices:check` DEBE consultar `pg_indexes` (y `pg_class`/`pg_am` si el tipo lo requiere) para verificar presencia y tipo de cada entrada de `REQUIRED`.
- **FR-003**: El sistema DEBE salir con código ≠ 0 si falta un índice esperado o si el tipo no coincide; DEBE salir con código 0 si todos están presentes con su tipo correcto.
- **FR-004**: Un índice presente en `pg_indexes` (schema `public`, no `pg_*`) que no aparece en `REQUIRED` DEBE producir una advertencia legible (prefijo `[INDICES] HUÉRFANO`), sin cambiar el código de salida.
- **FR-005**: El comando DEBE aceptar el flag `--json` que emite `{ ok, missing, wrongType, orphans, checkedAt, durationMs }` a stdout; sin `--json`, la salida DEBE ser humana con prefijo `[INDICES]` (conservar estilo de `[VERIFY HNSW]`).
- **FR-006**: El script `scripts/verify-hnsw-indexes.ts` DEBE ser el archivo extendido; NO se crea uno paralelo. El comando `pnpm db:verify:hnsw` DEBE seguir existiendo como alias funcional de `pnpm indices:check`.
- **FR-007**: `.github/workflows/ci.yml` DEBE ejecutar `npm run indices:check` en cada job que ya ejecute `npx prisma migrate deploy` (hoy L137, L234, L292), inmediatamente después de la migración. Un fallo del paso DEBE hacer fallar el job.
- **FR-008**: `scripts/deploy-prod.sh` DEBE ejecutar el guardián **entre L27 (`prisma migrate deploy`) y L41 (`sync-modulos-grants`)**. Si falla, el script DEBE salir con error (`set -e` lo garantiza) y **NO** debe intentar rollback automático.
- **FR-009**: `pi-monitor` (`scripts/monitor-probes.mjs`) DEBE incluir una señal `indices` que ejecute el guardián a la frecuencia definida por `ParametroSistema.monitoreo.indices.frecuencia_horas` (default `24`), registrar la probe como `HealthProbe` y exponer verde/rojo + lista de faltantes en el tablero. La probe NUNCA debe reiniciar nada.
- **FR-010**: `prisma/seed.ts` DEBE sembrar `monitoreo.indices.frecuencia_horas=24` mediante `upsert({create,update:{}})` para respetar valor custom del CEO (candado anti-I-100).
- **FR-011**: El script DEBE completar el chequeo de los 5 índices en **< 2 segundos** contra una BD de tamaño de producción (consultas a catálogos, no a datos).
- **FR-012**: El script NUNCA DEBE crear, alterar, reparar ni borrar índices. Solo lectura de `pg_indexes` / `pg_class` / `pg_am`.
- **FR-013**: NO se introducen cambios en `src/lib/ai/**` ni en las capas del motor. NO se renombra el índice truncado. NO se agregan índices nuevos declarativos en `schema.prisma` (fuera de alcance v1, brief §9).
- **FR-014**: La frontera DAL (Q-3) se respeta: el script mantiene su cliente propio (`import { prisma } from "../src/lib/prisma"` como ya lo hace) y NO se importa desde `src/app/**`.

### Key Entities

- **`REQUIRED`** (constante en `scripts/verify-hnsw-indexes.ts`): fuente única de verdad del guardián. Agregar un índice por SQL crudo obliga a declararlo aquí (esa es la disciplina forzada). Campos: `name` (nombre real, truncado si aplica), `table`, `type` (`btree`|`gin`|`hnsw`|`unique`), `sostiene` (una línea legible para el error), `migracion` (dónde nació el índice, para trazabilidad).
- **`ParametroSistema.monitoreo.indices.frecuencia_horas`**: entero (default `24`), editable por el CEO sin deploy. Mismo patrón que los demás parámetros de monitoreo.
- **`HealthProbe` (señal `indices`)**: registro persistente del último chequeo del monitor con timestamp, estado (`OK`/`FALTA`/`TIPO_INCORRECTO`) y payload JSON con los detalles. Reutiliza el modelo existente de `pi-monitor`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-000**: `pnpm db:verify:hnsw` sigue funcionando tras el cambio (no se rompe lo que ya existía). Se verifica corriendo el comando post-implementación con la misma salida esperada que antes en una BD sana.
- **SC-001**: `pnpm indices:check` en una BD sana devuelve salida 0 y reporta los **5** índices como `OK` (hoy solo verifica 2).
- **SC-002**: Borrando `Ciudad_nombreNormalizado_trgm_idx` en BD de prueba, `pnpm indices:check` devuelve salida ≠ 0 y nombra el índice, la tabla y qué se rompe.
- **SC-003**: Cambiando un índice vectorial de `hnsw` a `btree` en BD de prueba, el comando falla por tipo incorrecto y menciona el tipo esperado vs el encontrado.
- **SC-004**: Un índice extra no declarado produce advertencia (`HUÉRFANO`), **no** error; el comando sigue devolviendo salida 0.
- **SC-005**: Un PR de prueba que rompe un índice a propósito deja la CI roja en el paso `indices:check` y no se puede mergear.
- **SC-006**: `deploy-prod.sh` ejecuta el guardián tras `migrate deploy` (entre L27 y L41); si el guardián falla, el script termina con error y **no** continúa a `sync-modulos-grants`.
- **SC-007**: `pi-monitor` expone el resultado del último chequeo (fecha, estado, índices faltantes) en su endpoint de salud, y el parámetro `monitoreo.indices.frecuencia_horas` existe en BD tras el seed.
- **SC-008**: Test de integración que crea la BD desde cero, corre todas las migraciones y verifica que los 5 índices existen con su tipo correcto.
- **SC-009**: El chequeo completo de los 5 índices tarda < 2 s contra una BD de tamaño de producción (medido con `--json.durationMs`).

---

## Assumptions

- El worktree parte de `origin/feature/001-scaffolding` (`3df4f9cb`); esa base contiene ya los 5 índices en la BD real del VPS (verificado por el brief v1.1 y respaldado por la operación del motor en producción).
- El singleton `PrismaClient` en `src/lib/prisma.ts` es apto para scripts one-shot (no vive en el ciclo de request de Next) — el script actual ya lo importa así y funciona.
- La CI corre `npx prisma migrate deploy` contra una BD efímera antes del test de integración (verificado en `.github/workflows/ci.yml`: L137, L234, L292). Insertar `npm run indices:check` inmediatamente después reproduce las condiciones de prod.
- `pi-monitor` está corriendo en producción (SPEC-171) y su patrón de probes admite señales adicionales sin refactor mayor; se sigue la interfaz de `probeApp/probeWorker/probeBd`.
- La deuda de fondo (drift `schema.prisma` ↔ BD, renombrar el índice truncado) queda **fuera de alcance** de este frente (brief §9).
- Los cambios al motor IA (`src/lib/ai/**`) están **prohibidos** en este frente.
