# Feature Specification: IDs de advisory lock únicos (cierra I-130, I-137)

**Feature Branch**: `work/002-PI-184` (SPEC-284)
**SPEC**: 284
**Created**: 2026-08-26
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-184-IDS-ADVISORY-LOCK · I-130 (causa raíz reescrita) · I-137 (clase de fallo) · REPORTE-004-2026-08-26-2310 §1

Impacto en arquitectura: **cero cambios funcionales al motor** (`src/lib/ai/**` intacto) y **cero migraciones**. Se corrigen tres IDs numéricos en tres archivos de `scripts/` (`worker-senal-comunitaria.mjs`, `worker-sesiones.mjs`, `worker-tasas.mjs`) que hoy colisionan con el ID `123456790` del `monitor-probes.mjs`. El `monitor` conserva su ID por identidad (no cambia el que ya está bien). Se agrega **tabla única versionada** `scripts/ADVISORY-LOCKS.md` como fuente de verdad y **compuerta en CI** (`npm run locks:check`) que normaliza separadores de dígitos (`123_456_790` ≡ `123456790`) antes de comparar. La lógica de `pg_try_advisory_lock` / `pg_advisory_unlock` NO se toca.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El monitor arranca y HealthProbe deja de estar en cero (Priority: P1)

Con producción degradada (monitor en bucle de reinicio desde hace días, `HealthProbe` en 0 filas), Jelkin despliega el fix. Al aplicar los IDs únicos, `monitor-probes` toma su lock `123456790` sin competencia, y `worker-senal-comunitaria` (que hoy retiene el lock por escribirlo como `123_456_790`) mantiene su servicio bajo su ID nuevo `123456796`. `docker compose ps` muestra `monitor` **Up** (no `Restarting`) y `SELECT COUNT(*) FROM "HealthProbe"` devuelve **> 0** en menos de dos ciclos del probe.

**Why this priority**: Es la razón por la que se abrió el frente. Nadie vigila producción hasta que el monitor vuelva a correr; toda otra alerta silenciosa está enmascarada.

**Independent Test**: Post-deploy en el VPS: (a) `docker compose ps` reporta `monitor Up (healthy)` sin `Restarting`; (b) `psql -c 'SELECT COUNT(*) FROM "HealthProbe"'` devuelve > 0; (c) `pi-senal-comunitaria` sigue **Up** (no lo rompimos).

**Acceptance Scenarios**:

1. **Given** los cuatro workers desplegados con IDs únicos, **When** el sistema arranca, **Then** cada worker toma su propio lock y ninguno se queda en `pg_try_advisory_lock=false` en bucle.
2. **Given** el monitor arrancado, **When** transcurre un ciclo del probe (~30 s por defecto), **Then** aparecen filas nuevas en `HealthProbe`.
3. **Given** que `pi-senal-comunitaria` estaba **Up** antes del deploy, **When** el deploy termina, **Then** el servicio sigue **Up** — su lógica de lock no se tocó, solo cambió el número.

### User Story 2 — Tabla única como fuente de verdad de IDs (Priority: P1)

Un desarrollador va a agregar un worker nuevo. Antes de escribir el `ADVISORY_LOCK_ID`, abre `scripts/ADVISORY-LOCKS.md`, ve todos los IDs tomados con su worker y su servicio del compose, elige el siguiente libre y lo registra en la tabla. Si intenta reutilizar uno tomado, la compuerta de CI se lo bloquea antes del merge.

**Why this priority**: La causa raíz de I-130 es que no había un lugar único donde ver los IDs. Cuatro workers escribieron `123456790` en tres semanas de PRs distintos porque cada uno miraba solo su propio archivo. Sin fuente única no hay disciplina que forzar.

**Independent Test**: Abrir `scripts/ADVISORY-LOCKS.md` y ver una tabla con: ID · worker (archivo) · servicio del compose · qué protege. Verificar que corresponde 1:1 con lo que hay en `scripts/*.mjs` (contable con `grep -n "ADVISORY_LOCK_ID = " scripts/*.mjs`).

**Acceptance Scenarios**:

1. **Given** la tabla de `scripts/ADVISORY-LOCKS.md`, **When** un desarrollador consulta un ID, **Then** encuentra worker + servicio del compose + qué protege en una fila.
2. **Given** un worker nuevo, **When** el autor elige un ID libre, **Then** puede confirmar su unicidad revisando la tabla y no tiene que abrir 12 archivos.
3. **Given** la tabla, **When** aparece un desalineo entre lo que dice la tabla y lo que hay en `scripts/*.mjs`, **Then** la compuerta de CI (US3) lo caza y el PR queda rojo.

### User Story 3 — CI bloquea colisiones de IDs (incluyendo separadores JS) (Priority: P1)

Un PR intenta reutilizar `123456790` (o `123_456_790`, o `1_2_3_4_5_6_7_9_0`, o cualquier forma con separadores) para un worker nuevo. La compuerta `npm run locks:check` corre en el job `verificaciones`, normaliza los dígitos quitando `_` antes de comparar y falla el PR con un mensaje que nombra los dos workers en conflicto.

**Why this priority**: Sin esta compuerta, la disciplina de la tabla es solo documentación viva. Con la compuerta, el error queda bloqueado en el PR y no llega a producción. Es el único mecanismo que garantiza que I-130 no se reabra.

**Independent Test**: Modificar `scripts/worker-tasas.mjs` a `const ADVISORY_LOCK_ID = 123_456_796;` (colisión intencional con `worker-senal-comunitaria`) y correr `npm run locks:check` → salida ≠ 0 nombrando ambos archivos.

**Acceptance Scenarios**:

1. **Given** dos workers con el mismo ID literal, **When** corre `npm run locks:check`, **Then** sale ≠ 0 y el mensaje lista los archivos en conflicto y el ID compartido.
2. **Given** dos workers con IDs que difieren solo en separadores (`123456790` vs `123_456_790`), **When** corre la compuerta, **Then** también los detecta como colisión (normalización obligatoria).
3. **Given** ningún ID duplicado, **When** corre la compuerta, **Then** sale 0 y reporta el conteo de IDs verificados.
4. **Given** un ID declarado en `scripts/*.mjs` que NO aparece en `scripts/ADVISORY-LOCKS.md`, **When** corre la compuerta, **Then** sale ≠ 0 (fuente única de verdad — la tabla debe seguir siendo la fotografía completa).
5. **Given** un ID declarado en la tabla que NO existe en ningún `scripts/*.mjs`, **When** corre la compuerta, **Then** sale ≠ 0 (evita que la tabla se convierta en documento muerto).

### User Story 4 — worker-sesiones y worker-tasas quedan con ID propio aunque no tengan servicio en el compose (Priority: P2)

`worker-sesiones` y `worker-tasas` no tienen servicio corriendo en producción hoy (I-132 lo decidirá aparte), pero sus archivos declaran `ADVISORY_LOCK_ID = 123456790`. Son **bombas latentes**: en cuanto Jelkin decida levantarlos, competirían con el monitor por el mismo lock. Este frente les asigna ID propio ya mismo, aunque no se enciendan.

**Why this priority**: Costo marginal cero (una línea por archivo) y elimina un riesgo dormido. No forzarlo obliga a otro frente cuando I-132 se atienda, y para entonces la memoria ya se olvidó del porqué.

**Independent Test**: `grep -n "ADVISORY_LOCK_ID" scripts/worker-sesiones.mjs scripts/worker-tasas.mjs` reporta `123456797` y `123456798` respectivamente, sin `_` y con comentario que refiere SPEC-284.

**Acceptance Scenarios**:

1. **Given** los archivos post-fix, **When** se leen sus `ADVISORY_LOCK_ID`, **Then** son `123456797` y `123456798` respectivamente.
2. **Given** que ambos siguen sin servicio en el compose, **When** el fix se despliega, **Then** nada cambia en producción para ellos — solo dejan de ser una bomba latente en el código.

---

## Edge Cases

- **Separadores numéricos JavaScript**: `123_456_790`, `1_23_456_790`, `12__3456790` — la compuerta normaliza quitando `_` antes de comparar. El regex de extracción debe permitir dígitos y `_` en el mismo literal numérico.
- **Comentarios que mencionan IDs**: `// 791 reservado por otro worker del lote` NO debe contarse como declaración. La compuerta solo mira `const ADVISORY_LOCK_ID = <número>;` (o su variante multi-línea si aparece), no menciones libres.
- **Notación exponencial o hex**: fuera de alcance v1; la compuerta trabaja sobre decimales (con o sin `_`). Si alguien introduce `0x75BCD16` la compuerta lo ignora y el desalineo tabla ↔ código lo caza (US3 escenario 5).
- **Múltiples declaraciones en un mismo archivo**: se declara colisión intra-archivo si aparece más de un `ADVISORY_LOCK_ID = ...` en el mismo `.mjs`.
- **Encoding del comentario junto al ID nuevo**: el comentario aclara "sin `_`, para que el grep lo encuentre; ver SPEC-284" — así nadie lo "arregla" pensando que es un descuido.
- **Rebase con Desarrollo 1 (A-25)**: si Desarrollo 1 renombra archivos de `scripts/` durante A-25, la tabla debe rebasarse conservando ambos bloques (§9.6 del CLAUDE.md).
- **Ejecución local sin BD**: `npm run locks:check` es puro I/O de archivos (regex sobre `scripts/*.mjs` + parseo de `scripts/ADVISORY-LOCKS.md`). No abre conexiones a Postgres.
- **Presupuesto de tiempo**: < 500 ms — es un chequeo de texto sobre <20 archivos. Si excede 5 s, error de infraestructura (código 2), no de contenido.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE asignar IDs únicos a los cuatro workers hoy en colisión: `monitor-probes.mjs`=`123456790` (sin cambio), `worker-senal-comunitaria.mjs`=`123456796`, `worker-sesiones.mjs`=`123456797`, `worker-tasas.mjs`=`123456798`. Los otros ocho workers no se tocan.
- **FR-002**: El literal numérico DEBE escribirse en forma plana `123456796` (sin separadores `_`), acompañado de un comentario de una línea que explique por qué (evita el patrón que ocultó la colisión tres semanas y hace el ID greppeable).
- **FR-003**: El archivo `scripts/ADVISORY-LOCKS.md` DEBE existir con una tabla que liste: `ID` · `Worker (archivo)` · `Servicio del compose` (o `— sin servicio`) · `Qué protege` · `SPEC de origen`. Debe cubrir los **12 IDs** conocidos (los cuatro corregidos aquí y los ocho ya únicos).
- **FR-004**: `scripts/ADVISORY-LOCKS.md` DEBE declarar la regla operativa: "todo worker nuevo se registra aquí ANTES de existir; la compuerta `locks:check` verifica que tabla y `scripts/*.mjs` coinciden".
- **FR-005**: El comando `npm run locks:check` DEBE existir y DEBE ejecutar `tsx scripts/locks-check.ts` (o equivalente TypeScript en `scripts/`).
- **FR-006**: `scripts/locks-check.ts` DEBE escanear `scripts/*.mjs`, extraer cada declaración `const ADVISORY_LOCK_ID = <literal>;` (con o sin `_` en el literal), normalizar quitando `_`, y comparar dos a dos.
- **FR-007**: Si dos archivos declaran el mismo ID normalizado, `locks:check` DEBE salir ≠ 0 con mensaje que nombra ambos archivos y el ID compartido.
- **FR-008**: `locks:check` DEBE también parsear `scripts/ADVISORY-LOCKS.md` y verificar que el conjunto de IDs en la tabla coincide **exactamente** con el conjunto de IDs en `scripts/*.mjs` (misma cardinalidad, mismos números normalizados). Cualquier desalineo → salida ≠ 0 con el desalineo nombrado.
- **FR-009**: `locks:check` DEBE integrarse al job `verificaciones` de `.github/workflows/ci.yml` como paso nuevo, junto a `tokens:check` y `arch:check`. El paso DEBE hacer fallar el job si `locks:check` sale ≠ 0.
- **FR-010**: La **lógica de `pg_try_advisory_lock` / `pg_advisory_unlock`** NO se modifica. Solo cambian los números literales del ID.
- **FR-011**: NO se implementa "reclamar candado huérfano" (candado crítico del INSTRUCTIVO §Candados). El lock actual no está huérfano; lo tiene un proceso vivo. Reclamarlo mataría a `pi-senal-comunitaria`.
- **FR-012**: NO se levantan servicios (`worker-sesiones`, `worker-tasas`) que hoy no corren en el compose (I-132, decisión de negocio pendiente). Solo se les asigna ID propio a nivel de archivo.
- **FR-013**: NO se agregan migraciones. NO se toca `src/lib/ai/**`. La frontera DAL (Q-3) queda intacta.
- **FR-014**: La compuerta DEBE completar en **< 500 ms** localmente sobre el árbol actual de `scripts/`.
- **FR-015**: `locks:check` NO abre conexiones a Postgres. Es solo I/O de archivos + regex.

### Key Entities

- **`ADVISORY_LOCK_ID`** (constante en cada worker `scripts/*.mjs`): número entero decimal que identifica al lock de sesión en Postgres. Debe ser único a nivel de sistema. Formato plano sin separadores `_` obligatorio para que sea greppeable.
- **`scripts/ADVISORY-LOCKS.md`**: fuente única de verdad. Tabla con una fila por ID conocido. Se actualiza en el mismo PR que introduce un worker nuevo — nunca después.
- **`scripts/locks-check.ts`**: compuerta que consume dos entradas (la tabla y los `.mjs`) y decide si hay contradicción. Sin efectos colaterales; solo lectura y `process.exit`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Post-deploy, `docker compose ps` en el VPS muestra `monitor` en estado **Up** (no `Restarting`), sostenido durante al menos dos ciclos completos del probe (~2 minutos).
- **SC-002**: Post-deploy, `SELECT COUNT(*) FROM "HealthProbe"` en la BD de producción devuelve **> 0** dentro de los primeros dos minutos tras el arranque del monitor.
- **SC-003**: Post-deploy, `docker compose ps` muestra `pi-senal-comunitaria` en estado **Up** (no lo rompimos al cambiar solo los otros IDs).
- **SC-004**: `grep -n "ADVISORY_LOCK_ID" scripts/*.mjs` produce **12 líneas** con **12 valores normalizados distintos** (ningún duplicado). Comprobable con `grep -Eo '[0-9_]+' | tr -d '_' | sort -u | wc -l = 12`.
- **SC-005**: `npm run locks:check` en el árbol de la rama sale con código 0 y reporta "12 IDs verificados, sin colisiones".
- **SC-006**: Introduciendo a mano una colisión (por ejemplo `worker-tasas.mjs` con `123_456_796` = colisión con `worker-senal-comunitaria`), `npm run locks:check` sale ≠ 0 y el mensaje nombra ambos archivos.
- **SC-007**: Borrando una fila de `scripts/ADVISORY-LOCKS.md` (desalineo tabla ↔ código), `npm run locks:check` sale ≠ 0 nombrando el ID faltante.
- **SC-008**: El paso `- run: npm run locks:check` aparece en el job `verificaciones` de `.github/workflows/ci.yml`, y el PR de esta SPEC lo ejecuta en verde.
- **SC-009**: La compuerta completa en **< 500 ms** localmente (medido con `time npm run locks:check`).
- **SC-010**: `scripts/ADVISORY-LOCKS.md` existe con las 12 filas y la regla operativa.

---

## Assumptions

- El worktree parte de `origin/feature/001-scaffolding` (HEAD `30705bb9` al momento de la creación); esa base contiene los 12 workers actuales.
- El diagnóstico verificado por Fábrica (INSTRUCTIVO §Contexto) es correcto: el lock `123456790` en producción lo retiene `worker-senal-comunitaria` (proceso vivo), no una conexión zombi. Reclamar el lock desde `monitor-probes` está **prohibido**.
- La lógica actual de `pg_try_advisory_lock` / `pg_advisory_unlock` en los cuatro archivos funciona bien y no requiere ajuste — solo cambia el número.
- `worker-sesiones` y `worker-tasas` no corren hoy en el compose de producción (I-132). El fix les asigna ID propio como *housekeeping*; no cambia su ciclo de vida.
- Desarrollo 1 está en A-25 tocando otros archivos de `scripts/` (`worker-analisis-score`, `worker-supervisor`). Sin colisión con este frente. En caso de conflicto al rebasar, se conservan ambos bloques (§9.6 CLAUDE.md).
- La regla D-003 §4 (I-133) — *todo worker que use pg-boss crea sus colas antes de usarlas* — se **reporta** si aparece pendiente en un archivo tocado, pero NO se arregla aquí (I-131 ya está asignado a Desarrollo 1 en A-25).
- Cambios en `src/lib/ai/**` están **prohibidos**.
- No hay migraciones. No se toca schema Prisma.
