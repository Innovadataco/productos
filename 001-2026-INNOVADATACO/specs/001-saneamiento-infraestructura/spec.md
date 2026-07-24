# Feature Specification: Saneamiento de infraestructura

**Feature Branch**: `001-saneamiento-infraestructura`

**Created**: 2026-07-22

**Status**: **Terminada (ACTA-VALIDACION 001, 2026-07-23)**. Aprobada por ZEUS (arquitecto)
y Jelkin (CEO) el 2026-07-22.
Enmendada el 2026-07-22 con FR-010 (decisión ZEUS D-008) y FR-011 (decisión ZEUS
D-009); D-010 confirma el enfoque de Dockerfile (target builder + prisma generate)
y D-011 la recreación del volumen propio sin dump.

**Input**: User description: "Saneamiento de infraestructura del proyecto 001: BD propia
en puerto host 5435, unificación de credenciales/BD entre docker-compose y .env,
OLLAMA_BASEURL alcanzable desde contenedores, servicio worker en compose para
portabilidad 100% a VPS (ADR_001), y documentación PM2 (dev) vs docker compose (prod).
Alcance decidido por ZEUS y aprobado por el CEO."

## Contexto y problema actual

Estado verificado del repositorio a 2026-07-22:

1. **Conflicto de puerto de BD**: `docker-compose.yml` publica la BD en `"5432:5432"`.
   El puerto 5432 es el default global de PostgreSQL y este proyecto tiene asignados
   únicamente los puertos **5001** (app) y **5435** (BD) según ADR_002. Los puertos
   5005/5433 (Protección Infantil) y 5010/5434 (SICOV) pertenecen a otros productos.
2. **Dos verdades de credenciales**: `docker-compose.yml` hardcodea
   `innova`/`innova`/BD `innovadataco`, mientras `.env.example` declara
   `DATABASE_URL=postgresql://idc_admin:innovadataco2026@localhost:5432/innovadataco_001`.
   No existe una única fuente de verdad y el compose no lee credenciales de `.env`.
3. **Ollama inalcanzable desde contenedores**: el default de `OLLAMA_BASEURL` es
   `http://localhost:11434`; dentro de un contenedor, `localhost` es el contenedor
   mismo, no el host donde corre Ollama.
4. **Worker fuera de compose**: el worker de colas (`scripts/worker.mjs`, pg-boss)
   solo existe en PM2 (`ecosystem.config.js`); `docker-compose.yml` no lo declara,
   por lo que un despliegue por compose quedaría sin procesamiento asíncrono
   (incumple el criterio de portabilidad del ADR_001: repo + .env + docker compose up).
5. **Roles de PM2 y compose sin documentar**: el README no explica que PM2 es el
   modo de desarrollo en Mac y docker compose sobre Colima el modo producción/VPS.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - BD propia en el puerto asignado (Priority: P1)

Como operador de la fábrica IDC, quiero que la base de datos del proyecto 001 se
publique en el puerto host **5435** (el asignado por ADR_002), para que los tres
productos de la MacStudio convivan sin colisiones de puertos y sin riesgo de que
001 capture el 5432 global.

**Why this priority**: Es la corrección de aislamiento multiproyecto (§0.5 de la
constitución); una colisión de puertos puede tumbar o bloquear la infra de otros
productos. Todo lo demás depende de que la BD quede en su puerto propio.

**Independent Test**: Levantar solo el servicio `db` con compose y verificar que
escucha en `localhost:5435` y que 5005/5433/5010/5434 no cambian de estado.

**Acceptance Scenarios**:

1. **Given** el compose saneado, **When** se ejecuta `docker compose config`,
   **Then** el servicio `db` mapea `"5435:5432"` y ningún servicio publica 5432,
   5005, 5433, 5010 ni 5434.
2. **Given** el stack levantado, **When** un cliente se conecta a
   `localhost:5435`, **Then** responde la BD de 001.
3. **Given** el stack de 001 levantado o detenido, **When** se inspeccionan los
   puertos 5005/5433 (PI) y 5010/5434 (SICOV), **Then** su estado es idéntico al
   previo (ningún proceso ni contenedor ajeno fue tocado).

---

### User Story 2 - Una sola verdad de credenciales/BD (Priority: P1)

Como desarrollador, quiero que las credenciales y el nombre de la BD vivan
únicamente en `.env` y que tanto compose como la app las lean de ahí, para que no
haya divergencia entre entornos ni secretos hardcodeados (12-factor, ADR_001).

**Why this priority**: La divergencia actual (`innova/innova/innovadataco` vs
`idc_admin/.../innovadataco_001`) produce entornos rotos e impide la portabilidad;
además hay credenciales hardcodeadas en el compose (viola §0.4).

**Independent Test**: Con un `.env` de prueba, `docker compose config` debe
renderizar usuario/contraseña/BD tomados de ese `.env` y ninguna credencial debe
quedar literal en `docker-compose.yml`.

**Acceptance Scenarios**:

1. **Given** `.env` con `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB`
   definidos, **When** se ejecuta `docker compose config`, **Then** el servicio
   `db` usa esos tres valores y el compose no contiene credenciales literales.
2. **Given** la app corriendo dentro de compose, **When** lee `DATABASE_URL`,
   **Then** apunta a host `db:5432` con las mismas credenciales de `.env`.
3. **Given** desarrollo fuera de docker (PM2), **When** la app lee `DATABASE_URL`
   de `.env`, **Then** apunta a `localhost:5435` con las mismas credenciales.
4. **Given** el repositorio en git, **When** se inspecciona el índice/historial
   nuevo, **Then** `.env` no está commiteado (solo `.env.example`, sin secretos
   reales) — `.env` permanece en `.gitignore`.

---

### User Story 3 - Ollama alcanzable desde contenedores (Priority: P2)

Como usuario del módulo de IA, quiero que los contenedores (app y worker) alcancen
el Ollama del host, para que la inferencia local por defecto (§0.6) funcione
también cuando el stack corre en docker.

**Why this priority**: Sin esto, todo flujo de IA falla en modo compose; pero la
app "no-IA" sigue operativa, por eso es P2 y no P1.

**Independent Test**: Desde dentro del contenedor de la app, una petición HTTP a
`OLLAMA_BASEURL` debe llegar al Ollama del host.

**Acceptance Scenarios**:

1. **Given** el compose saneado sin `OLLAMA_BASEURL` en `.env`, **When** se
   renderiza la config, **Then** el default dentro de los contenedores es
   `http://host.docker.internal:11434`, con `extra_hosts:
   ["host.docker.internal:host-gateway"]` si el runtime lo requiere (Colima/Linux).
2. **Given** desarrollo fuera de docker, **When** la app lee `OLLAMA_BASEURL` de
   `.env`, **Then** sigue siendo `http://localhost:11434`.
3. **Given** un valor explícito de `OLLAMA_BASEURL` en `.env`, **When** se levanta
   el stack, **Then** ese valor tiene precedencia sobre el default.

---

### User Story 4 - Worker en compose: VPS = 100% compose (Priority: P2)

Como operador que migrará a un VPS, quiero que el worker de colas sea un servicio
del `docker-compose.yml`, para que `repo + .env + docker compose up` levante el
sistema completo (app + BD + worker) sin pasos manuales (ADR_001).

**Why this priority**: Es la pieza que falta para el criterio de portabilidad;
depende de que credenciales y puertos (US1/US2) estén saneados primero.

**Independent Test**: `docker compose config` muestra el servicio `worker` con la
misma imagen/build que `app`, `command` propio hacia `scripts/worker.mjs`, y al
levantar el stack el worker procesa un job de la cola pg-boss.

**Acceptance Scenarios**:

1. **Given** el compose saneado, **When** se ejecuta `docker compose config`,
   **Then** existe un servicio `worker` que reutiliza el mismo Dockerfile que
   `app`, con `command` propio para ejecutar `scripts/worker.mjs`, sin puertos
   publicados, con `DATABASE_URL` hacia `db:5432` y `depends_on: db`.
2. **Given** el stack levantado, **When** se encola un job (p. ej. procesamiento
   de documento), **Then** el worker lo consume y el estado del job progresa
   (`queued` → `processing` → estado final).

---

### User Story 5 - Documentación de modos de ejecución (Priority: P3)

Como nuevo integrante (humano o agente), quiero que el README de 001 explique que
**PM2 = desarrollo en Mac** y **docker compose sobre Colima = producción/VPS**,
para saber qué modo usar sin arqueología de archivos.

**Why this priority**: Es documentación; no bloquea operación, pero evita errores
de operación futuros.

**Independent Test**: Leer el README y encontrar la sección con ambos modos, sus
comandos y cuándo usar cada uno.

**Acceptance Scenarios**:

1. **Given** el README actualizado, **When** se busca la sección de ejecución,
   **Then** documenta PM2 (`ecosystem.config.js`) como modo desarrollo en Mac y
   docker compose sobre Colima como modo producción/VPS, incluyendo el puerto de
   BD 5435 y la ruta de migración a VPS (repo + .env + docker compose up).

### Edge Cases

- ¿Qué pasa si el puerto 5435 ya está ocupado en el host al levantar el stack?
  → El compose falla con error de bind; el operador lo reporta. PROHIBIDO liberar
  el puerto matando procesos ajenos (regla ADR_002 / AGENTS.md).
- ¿Qué pasa si `.env` no existe o le faltan variables? → Compose debe fallar de
  forma explícita (variables requeridas sin default para credenciales) en lugar de
  levantar con credenciales fantasma; `.env.example` documenta todas las variables.
- ¿Qué pasa con datos existentes del volumen `innovadataco_db_data` creados con las
  credenciales viejas (`innova`)? → Ver Assumptions: se asume entorno dev
  recreable; si hay datos que conservar, se decidirá en el plan (dump/restore).
- ¿Qué pasa si Ollama no está corriendo en el host? → Las rutas de IA responden
  503 (sin modelo disponible) según la constitución §2.4; el resto de la app opera.
- ¿Colima soporta `host.docker.internal`? → Debe validarse en el plan; por eso el
  compose incluye `extra_hosts: host-gateway` como respaldo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `docker-compose.yml` MUST publicar la BD en el puerto host **5435**
  (mapeo `"5435:5432"`), y MUST NOT publicar ni modificar ningún otro puerto del
  host distinto de 5001 y 5435. Los puertos 5005, 5433, 5010 y 5434 quedan
  explícitamente fuera de todo cambio.
- **FR-002**: `docker-compose.yml` MUST leer `POSTGRES_USER`, `POSTGRES_PASSWORD`
  y `POSTGRES_DB` desde `.env` (sin valores de credenciales hardcodeados en el
  archivo compose).
- **FR-003**: MUST existir una única fuente de verdad de credenciales/BD: los
  valores de `.env` alimentan tanto al servicio `db` como a los `DATABASE_URL` de
  `app` y `worker`. La divergencia actual (`innova/innova/innovadataco` vs
  `idc_admin/innovadataco2026/innovadataco_001`) queda eliminada.
- **FR-004**: `DATABASE_URL` MUST ser coherente por entorno: host `db:5432` para
  procesos dentro de la red compose; host `localhost:5435` para desarrollo fuera
  de docker (PM2). Ambas formas usan las mismas credenciales de `.env`.
- **FR-005**: `.env.example` MUST actualizarse con todas las variables nuevas
  (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` con puerto
  5435, `OLLAMA_BASEURL`) y valores de ejemplo sin secretos reales. Se MUST crear
  un `.env` local funcional que NUNCA se commitea (`.env` sigue en `.gitignore`).
- **FR-006**: El default de `OLLAMA_BASEURL` dentro de los contenedores MUST ser
  `http://host.docker.internal:11434`, añadiendo `extra_hosts` con `host-gateway`
  si el runtime (Colima) lo requiere. Fuera de docker el valor de referencia sigue
  siendo `http://localhost:11434`. Un valor explícito en `.env` MUST tener
  precedencia sobre el default.
- **FR-007**: `docker-compose.yml` MUST incluir un servicio `worker` que: (a)
  construye con el mismo Dockerfile que `app`; (b) define `command` propio para
  ejecutar `scripts/worker.mjs`; (c) recibe el mismo `DATABASE_URL` (hacia
  `db:5432`) y `OLLAMA_BASEURL` que `app`; (d) no publica puertos; (e) declara
  `depends_on` sobre `db`.
- **FR-008**: El README de 001 MUST documentar los dos modos de ejecución:
  PM2 (`ecosystem.config.js`) = desarrollo en Mac; docker compose sobre Colima =
  producción/VPS, incluyendo el criterio ADR_001 de migración a VPS
  (repo + `.env` + `docker compose up`).
- **FR-009**: Ningún cambio de esta spec MUST tocar archivos, contenedores,
  volúmenes o puertos de `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC`.
- **FR-010** *(enmienda ZEUS D-008, 2026-07-22 — resuelve H-01/D-07)*: los
  fallbacks hardcodeados de Ollama en el código
  (`src/lib/modelClients.ts`, `src/app/api/config/models/discover/route.ts`,
  `src/app/api/config/apis/[id]/test/route.ts`) y el literal del seed
  (`scripts/seedApis.mjs`) MUST pasar a usar
  `process.env.OLLAMA_BASEURL ?? "http://localhost:11434"`.
  **Precedencia**: el valor configurado en BD/UI manda; la variable de entorno
  solo reemplaza defaults/fallbacks (y el literal sembrado). El código tocado
  MUST llevar tests Vitest (constitución §0.2).
- **FR-011** *(enmienda ZEUS D-009, 2026-07-22)*: el servicio `db` MUST declarar
  `healthcheck` con `pg_isready`; `app` y `worker` MUST usar `depends_on` con
  `condition: service_healthy`; los tres servicios MUST declarar
  `restart: unless-stopped`.

### Key Entities

- **Servicio `db`**: PostgreSQL 16 + pgvector; puerto host 5435; credenciales
  parametrizadas desde `.env`; volumen `innovadataco_db_data`.
- **Servicio `app`**: Next.js (puerto 5001); consume `DATABASE_URL` (red interna
  `db:5432`) y `OLLAMA_BASEURL`.
- **Servicio `worker`**: proceso de cola pg-boss (`scripts/worker.mjs`); misma
  imagen que `app`, `command` propio; sin puertos publicados.
- **`.env` / `.env.example`**: única fuente de verdad de configuración y
  credenciales; `.env` fuera de git, `.env.example` como plantilla sin secretos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `docker compose config` valida sin errores y renderiza: BD en
  `5435:5432`, servicio `worker` presente, credenciales tomadas de `.env`.
- **SC-002**: La BD del proyecto responde en `localhost:5435`; ningún servicio del
  proyecto escucha en 5432.
- **SC-003**: Los puertos 5005, 5433, 5010 y 5434 permanecen sin ningún cambio de
  estado antes/después de aplicar la spec (PI y SICOV intactos).
- **SC-004**: Existe una sola definición de credenciales (en `.env`); cero
  credenciales literales en `docker-compose.yml`; `git ls-files` no incluye `.env`.
- **SC-005**: Desde el contenedor de `app`, `OLLAMA_BASEURL` resuelve al Ollama
  del host (petición HTTP exitosa con Ollama corriendo).
- **SC-006**: Un despliegue limpio con solo `repo + .env + docker compose up`
  levanta app + BD + worker y un job encolado es procesado de punta a punta.
- **SC-007**: El README describe ambos modos de ejecución (PM2 dev / compose
  prod-VPS) de forma que un operador nuevo elige el modo correcto sin ayuda.

## Assumptions

- El entorno de desarrollo actual es recreable: no hay datos productivos en el
  volumen `innovadataco_db_data`; si al ejecutar el plan se detectan datos a
  conservar, la migración (dump/restore con credenciales nuevas) se definirá en
  el plan de implementación.
- Las credenciales canónicas serán las de la línea `.env.example`
  (`idc_admin` / BD `innovadataco_001`) salvo que ZEUS defina otras; la contraseña
  real vivirá solo en `.env` local.
- Ollama corre en el host (MacStudio hoy, VPS mañana) escuchando en `:11434`; no
  se contenedoriza Ollama en esta spec.
- Colima es el runtime docker en Mac; la validación de `host.docker.internal` con
  `host-gateway` se hará durante la implementación (no en esta spec).
- Esta spec NO se implementa todavía: requiere aprobación de ZEUS y Jelkin
  (Regla de Oro 1). El plan (`/speckit-plan`) se ejecutará después de la
  aprobación.

## Out of Scope

- Cualquier cambio en 002-Protección Infantil o 003-SICOV (archivos, contenedores,
  volúmenes, puertos 5005/5433/5010/5434).
- Contenedorización de Ollama o cambios en la gestión de modelos IA.
- Cambios de esquema de BD, migraciones Prisma o lógica de aplicación.
- Ejecución de inferencia o pruebas de carga (requieren turno aprobado, ADR_002).
- Módulo Financials (permanentemente fuera de scope por constitución).
