# Feature Specification: SPEC-178 — Hotfix I-58: el monitor de infraestructura arranca en producción

**Feature Branch**: `work/002-pi-nocturno-20260817` (parche sobre PR #55)

**Created**: 2026-08-18

**Status**: IMPLEMENTADO

**Implementación** (2026-08-18): ver [cierre.md](./cierre.md). Servicio `monitor` en compose prod + evidencia local (probes frescos en HealthProbe, advisory lock exit 2) + cron de deriva confirmado registrado.

Impacto en arquitectura: un servicio nuevo `monitor` en `docker-compose.prod.yml` (mismo patrón que `worker`). Sin cambios de código de aplicación ni de modelo.

**Input**: Auditoría ZEUS de PR #55 (I-58). Contexto: SPEC-171 entregó `scripts/monitor-probes.mjs` (el vigilante que escribe `HealthProbe` y abre `IncidenteInfra`), pero en producción NADA lo arranca — el servicio `worker` corre `worker-supervisor.mjs`, que solo levanta el worker de reportes. Los 6 semáforos del tablero leen `HealthProbe` de la BD: sin el proceso que los escribe, saldrían vacíos en prod. En dev sí arranca (dev-restart.sh ya lo incluye).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El vigilante corre en producción desde el arranque del stack (Priority: P1)

Como plataforma quiero que el monitor de infraestructura arranque con `docker compose up` en prod, para que los semáforos del tablero operativo muestren datos reales y los incidentes disparen email.

**Why this priority**: sin esto, SPEC-171 es código muerto en prod (I-51 seguiría abierto de facto).

**Independent Test**: con el stack de prod levantado, `HealthProbe` recibe filas frescas y `GET /api/admin/monitoreo/estado` devuelve `ultimoProbeEn` reciente por señal.

**Acceptance Scenarios**:

1. **Given** `docker-compose.prod.yml`, **Then** existe un servicio `monitor` con la imagen de la app, `command: node --import tsx scripts/monitor-probes.mjs`, `env_file: .env.production`, `restart: always`, volumen `pi_worker_run` en `/app/run` (el monitor lee el heartbeat del worker de ahí) y `depends_on` db healthy + app started.
2. **Given** el stack corriendo, **When** pasan ~2 minutos, **Then** `HealthProbe` tiene filas recientes para las señales periódicas (app, worker, bd, ollama_ping; ollama_smoke según su intervalo de 5 min; tailscale "no-aplica" si no hay URL).
3. **Given** un segundo arranque accidental del monitor (u otro contenedor), **Then** el advisory lock de PostgreSQL hace que el segundo salga con código 2 sin pisar al primero.
4. **Given** el worker de reportes, **Then** el cron semanal de deriva de SPEC-172 (`motor-deriva-semanal`) está REGISTRADO en su arranque (verificado en fuente: `worker-reportes.mjs:502-504` con `boss.schedule` + `boss.work`) — esta spec lo documenta y lo prueba, no lo cambia.

---

### Edge Cases

- Monitor reiniciado solo: `restart: always` del servicio lo levanta; el advisory lock evita duplicados si el viejo no murió del todo.
- `monitoreo.enabled = false`: el monitor corre pero no escribe probes (ya implementado en SPEC-171).
- Tailscale sin URL configurada: probe "no-aplica", sin errores.
- La imagen de la app ya incluye tsx (el supervisor lo usa hoy para el worker de reportes).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `docker-compose.prod.yml` DEBE incluir el servicio `monitor` con el patrón del servicio `worker` (misma imagen, env_file, restart, volumen de run, depends_on).
- **FR-002**: La documentación de despliegue DEBE mencionar el servicio monitor (qué hace, cómo verificarlo: `docker compose ps` + filas en `HealthProbe`).
- **FR-003**: La spec DEBE dejar evidencia de la prueba local: monitor corriendo → `HealthProbe` con filas frescas → endpoint `estado` con `ultimoProbeEn` reciente (o verificación equivalente por BD si el endpoint exige sesión admin).
- **FR-004**: La spec DEBE confirmar en cierre que el cron `motor-deriva-semanal` está registrado en el arranque del worker (ya verificado en fuente: `worker-reportes.mjs:502-504`).
- **FR-005**: Cero cambios al código del monitor ni del worker; solo orquestación (compose) + docs.

### Key Entities

- **Servicio `monitor`** (compose): proceso que corre `monitor-probes.mjs` con advisory lock.
- **HealthProbe** (existente, SPEC-171): donde el monitor escribe; lo lee el tablero.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `docker compose -f docker-compose.prod.yml config` renderiza el servicio monitor sin errores.
- **SC-002**: Prueba local: con el monitor corriendo ≥ 2 min, `HealthProbe` muestra filas de las señales con `creadoEn` reciente.
- **SC-003**: Gate local verde (arch:check incluye rutas/comandos si el checker los cubre) + CI del PR #55 verde tras el push.

## Assumptions

- El patrón elegido es servicio propio en compose (opción B del instructivo) — no enganchar el monitor dentro del supervisor: proceso separado = restart independiente, logs separados, y el advisory lock ya evita duplicados. El supervisor queda solo con el worker de reportes.
- El monitor necesita el volumen `pi_worker_run` SOLO para leer el heartbeat del worker (probe de la señal `worker`).
- En dev ya arranca vía `dev-restart.sh` (hecho en SPEC-171); esta spec cierra el hueco de prod.
