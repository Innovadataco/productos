# Feature Specification: SPEC-290 — Levantar `worker-sesiones` como servicio del stack (SC-A28)

**Feature Branch**: `work/002-PI-190`

**Created**: 2026-08-27

**Status**: `PLANEADO`

Impacto en arquitectura: se agrega un servicio nuevo (`pi-sesiones`) al stack de `docker-compose.prod.yml` (y su equivalente en `docker-compose.yml` de dev) que corre el worker ya construido en SPEC-206 (`scripts/worker-sesiones.mjs`). El worker gana una única línea: un `touch` de vida en `/tmp/pi-sesiones-alive` al final de cada tick, para alimentar el healthcheck del contenedor. Se agrega una nueva sección `sesiones` al panel `/dashboard/admin/configuracion` que expone los 2 parámetros ya sembrados (`sesion.timeout_inactividad_minutos`, `sesion.worker_intervalo_minutos`). La actualización de `scripts/ADVISORY-LOCKS.md` refleja el nuevo servicio para la fila 8 (ID `123456797`).

**Input** (BRIEF-A-28 §1 y §3): el worker existe, está parametrizado y con lock único desde SPEC-284, pero **no corre**. Las sesiones de todos los usuarios nunca se cierran por inactividad — control de seguridad muerto en un producto que maneja datos de menores. D-86 autoriza levantarlo ahora que SPEC-284 liberó el candado del advisory lock.

**Dependencias**: SPEC-206 (worker construido), SPEC-284 (lock ID único), D-86 (autorización). Cero cambios al modelo Prisma, a `SesionLog`, ni a la lógica del worker.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Las sesiones inactivas se cierran automáticamente en prod (Priority: P1)

Como responsable de seguridad quiero que las sesiones de todos los usuarios se cierren automáticamente cuando llevan más del timeout parametrizado sin actividad.

**Independent Test**: `docker compose ps` en prod muestra `pi-sesiones Up (healthy)`. Sesión con `iniciadaEn = ahora − 61 min` y `timeout=30 min` → tras ≤ 6 min pasa a `finalizadaEn != NULL`.

**Acceptance Scenarios**:
1. **Given** el stack de prod recién arrancado, **When** transcurren 60 segundos, **Then** `docker ps` muestra `pi-sesiones` con estado `Up (healthy)`.
2. **Given** una fila en `SesionLog` con `iniciadaEn = ahora − 61 min`, `finalizadaEn = NULL` y el parámetro `sesion.timeout_inactividad_minutos = 30`, **When** el worker corre un tick, **Then** la fila queda con `finalizadaEn != NULL` y `motivoCierre = "inactividad"` (o el motivo que ya use `SessionLogService.cerrarPorInactividad`).
3. **Given** el worker en marcha, **When** transcurren 90 segundos sin tick (colgado / bloqueado), **Then** el healthcheck del contenedor pasa a `unhealthy` porque el archivo `/tmp/pi-sesiones-alive` tiene más de 60 s.

### User Story 2 — Admin ajusta el timeout desde el panel con auditoría (Priority: P1)

Como admin quiero cambiar el timeout de inactividad y el intervalo del worker desde `/dashboard/admin/configuracion` sin tocar el servidor.

**Independent Test**: abrir `/dashboard/admin/configuracion` como ADMIN → pestaña Parámetros → sección Sesiones. Los 2 parámetros aparecen editables. Cambiar `sesion.timeout_inactividad_minutos` de 30 a 60. Verificar en `AuditLog` que hay una fila `accion="PARAM_UPDATE"` con `recursoId` del ParametroSistema, `valorAnterior=30`, `valorNuevo=60` y `usuarioId=<admin>`.

**Acceptance Scenarios**:
1. **Given** un ADMIN autenticado, **When** entra a la sección Sesiones del panel, **Then** ve `sesion.timeout_inactividad_minutos` (default 30) y `sesion.worker_intervalo_minutos` (default 5) con sus descripciones.
2. **Given** el ADMIN cambia el timeout de 30 a 60, **When** guarda, **Then** aparece una fila `AuditLog` con `accion="PARAM_UPDATE"`, `valorAnterior=30`, `valorNuevo=60`, `usuarioId=<admin.id>`, `tipoRecurso="ParametroSistema"`.
3. **Given** el ADMIN cambia el intervalo del worker a un valor fuera de rango (< 1 o > 30), **When** intenta guardar, **Then** el UI rechaza el guardado con un error legible en español.

### User Story 3 — Verificación en vivo del cierre por inactividad (Priority: P1 · SC-5 brief)

Como Desarrollo, antes de decir REALIZADO, hago login en prod, espero más del timeout, y verifico que la siguiente request devuelve 401.

**Acceptance Scenarios**:
1. **Given** un login en prod recién hecho, **When** transcurre `timeout_inactividad_minutos + intervalo_worker_minutos + 1 min` sin actividad, **Then** la próxima request autenticada devuelve `401` con el mensaje de sesión expirada.

### Edge Cases

- ¿Y si dos réplicas de `pi-sesiones` arrancan por error? — el advisory lock `123456797` deja pasar solo a una; la segunda muere con `exit 2` y `restart: always` la reencola sin loop infinito porque la primera sigue viva.
- ¿Y si el touch de vida escribe en un FS de solo lectura? — `worker-sesiones.mjs` captura la excepción y sigue con el tick; el healthcheck fallará y `restart: always` reciclará el contenedor. **No** se propaga la excepción a la lógica de cierre.
- ¿Y si el admin sube `sesion.timeout_inactividad_minutos` a 240 estando el worker corriendo con 30? — el worker lee el parámetro en cada arranque (no en cada tick); el cambio surte efecto tras el próximo `restart` del contenedor. Se documenta en la descripción del parámetro en el panel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE agregarse un servicio nuevo `pi-sesiones` a `docker-compose.prod.yml` **y** a `docker-compose.yml` (dev), siguiendo el patrón exacto de `pi-vigencia` / `pi-analisis-reglas` (`image: pi-app:${PI_APP_TAG:-latest}`, `restart: always`, `env_file: .env.production` en prod, `depends_on.db.condition: service_healthy` + `depends_on.app.condition: service_started`).
- **FR-002**: El servicio DEBE tener `command: node --import tsx scripts/worker-sesiones.mjs` — cero build nuevo, reutiliza la imagen.
- **FR-003**: El servicio DEBE definir healthcheck `["CMD-SHELL", "test -f /tmp/pi-sesiones-alive && test $(($(date +%s) - $(stat -c %Y /tmp/pi-sesiones-alive))) -lt 90 || exit 1"]` con `interval: 60s`, `timeout: 5s`, `retries: 3`.
- **FR-004**: `scripts/worker-sesiones.mjs` DEBE escribir el archivo `/tmp/pi-sesiones-alive` (touch) al final de cada tick del `boss.work(...)`. La escritura DEBE ir dentro de un `try/catch` que loguea y sigue.
- **FR-005**: DEBE agregarse una sección `sesiones` a `SECTIONS` en `src/components/modules/config-panel/types.ts` con `prefixes: ["sesion."]`, label "Sesiones" y descripción breve.
- **FR-006**: NO se agrega ningún parámetro nuevo a `prisma/seed.ts` — los 2 requeridos (`sesion.timeout_inactividad_minutos`, `sesion.worker_intervalo_minutos`) ya están sembrados. El panel los descubre por prefijo.
- **FR-007**: Al guardar un parámetro `sesion.*` desde el panel, DEBE registrarse un AuditLog reutilizando la infraestructura existente del `ConfiguracionService` (SPEC-053), con `accion="PARAM_UPDATE"`, `tipoRecurso="ParametroSistema"`, `valorAnterior`, `valorNuevo`, `usuarioId`. **NO se agrega un enum nuevo `CONFIG_SESIONES_ACTUALIZADA`** — eso requeriría migración, prohibida por candados del instructivo.
- **FR-008**: DEBE actualizarse la fila 8 de `scripts/ADVISORY-LOCKS.md` (ID `123456797`, worker `worker-sesiones.mjs`): la columna "Servicio del compose" pasa de `— sin servicio (I-132 pendiente)` a `` `pi-sesiones` `` y la columna "Qué protege" quita el sufijo `(latente)`.
- **FR-009**: NO se toca la lógica del worker (mecanismo de cierre, cola, lock, parámetros dinámicos). **Solo** se agrega la línea del touch.
- **FR-010**: NO se toca `SesionLog`, el schema de Prisma, ni `src/lib/ai/**`.
- **FR-011**: DEBE existir un test unitario nuevo para el helper de touch (idempotente, tolerante a FS de solo lectura), sin BD.
- **FR-012**: DEBE existir un test smoke que verifica el mapeo `sesion.*` → sección `sesiones` en `types.ts` (grep de la lista).

### Key Entities

- `docker-compose.prod.yml` y `docker-compose.yml` — nuevo servicio `pi-sesiones`.
- `scripts/worker-sesiones.mjs` — touch de vida al final del tick.
- `src/components/modules/config-panel/types.ts` — sección nueva `sesiones`.
- `scripts/ADVISORY-LOCKS.md` — fila 8 actualizada.

## Success Criteria *(mandatory)*

- **SC-A28-1 (brief §5.1)**: `docker ps` en prod muestra `pi-sesiones Up (healthy)`.
- **SC-A28-2 (brief §5.2)**: sesión con `iniciadaEn = ahora − 61 min` → tras ≤ 6 min queda con `finalizadaEn != NULL`.
- **SC-A28-3 (brief §5.3)**: el panel admin permite cambiar `sesion.timeout_inactividad_minutos` de 30 a 60 y el AuditLog registra el cambio.
- **SC-A28-4 (brief §5.4)**: `scripts/ADVISORY-LOCKS.md` fila 8 pasa de `— sin servicio` a `pi-sesiones`.
- **SC-A28-5 (brief §5.5)**: verificación en vivo por Desarrollo antes de REALIZADO — login prod, esperar más del timeout, próxima request → `401`.

## Assumptions

- La imagen `pi-app:${PI_APP_TAG:-latest}` ya incluye `tsx` en `node_modules` (los otros workers lo usan) — cero cambio de Dockerfile.
- El coreutils `date +%s` y `stat -c %Y` están disponibles en la base image (Alpine/Debian) que usan los otros workers vivos — patrón heredado.
- El endpoint `PATCH /api/config/parametros/[clave]` ya cubre auditoría vía `ConfiguracionService` (SPEC-053), por lo que **no hay endpoint nuevo**.
- Los 2 parámetros `sesion.*` ya están sembrados en `prisma/seed.ts` (verificado: líneas 1771 y 1774 del archivo) con `categoria=SYSTEM`, `esPublico=false`.
- `sesion.ping_intervalo_minutos` y `sesion.retencion_dias` ya están sembrados también y quedarán expuestos automáticamente en la nueva sección `sesiones`. Se acepta como beneficio secundario (misma familia de parámetros; no requieren workflow especial).
