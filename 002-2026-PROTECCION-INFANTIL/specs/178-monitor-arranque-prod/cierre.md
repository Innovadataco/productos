# Cierre: SPEC-178 — Hotfix I-58 (el monitor de infra arranca en prod)

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-nocturno-20260817` (parche sobre PR #55) · **Compuerta §4**: APROBADA por ZEUS.

## Qué se implementó

1. **`docker-compose.prod.yml`**: nuevo servicio `monitor` (imagen de la app, `command: node --import tsx scripts/monitor-probes.mjs`, `env_file: .env.production`, `restart: always`, volumen `pi_worker_run` en `/app/run` — lee el heartbeat del worker para la señal `worker` —, `API_BASE_URL: http://app:3000` para la señal `app`, `depends_on` db healthy + app started). El `worker-supervisor` queda SOLO con reportes (intacto).
2. **`docs/despliegue/produccion-vps.md`**: diagrama con `pi-monitor` + runbook (logs, verificación con SELECT de `HealthProbe`, qué revisar si los semáforos salen vacíos).
3. **`docs/architecture/06-stack.md`**: regenerado (el generador registró `scripts/monitor-probes.mjs`).

## Cron de deriva (SPEC-172) — confirmado REGISTRADO

`worker-reportes.mjs:502-504`: `ensureQueue("motor-deriva-semanal")` + `boss.schedule("motor-deriva-semanal", "0 7 * * 1", {}, { tz: "America/Bogota" })` + `boss.work(...)`. Corre dentro del worker de reportes que prod ya levanta (servicio `worker`).

## Evidencia local (monitor real corriendo)

- Monitor arrancado contra la BD de dev: **advisory lock adquirido**, probes ejecutando cada ciclo.
- `HealthProbe` tras ~2 min: **2 corridas completas de las 6 señales** con `creadoEn` fresco (SELECT real):

  | senal | ok | nota |
  |-------|----|------|
  | bd | ✅ | |
  | tailscale | ✅ | (sin URL → no-aplica, por diseño) |
  | app | ❌ | 503 del health/worker (sin worker local) — correcto |
  | worker | ❌ | sin heartbeat local — correcto |
  | ollama_ping / ollama_smoke | ❌ | Ollama apagado en la Mac — correcto; el smoke leyó el **modelo vigente del motor** (`gemma2:27b`, decisión ZEUS) |

- Primer fallo NO abre incidente: re-probe a los 60 s programado (doble-rojo, por diseño).
- **Segundo arranque del monitor → exit code 2** ("Lock de instancia ya está en uso; otro monitor está activo") — instancia única garantizada.

## Gate local

tsc ✅ · eslint --no-cache ✅ (0 errores) · arch:check ✅ · tokens ✅ · unit 832/832 ✅ · journeys 47/47 ✅ · build ✅ (tras regenerar el cliente Prisma de la rama) · compose config renderiza `pi-monitor` sin errores ✅

## Nota

- Sin cambios de código del monitor ni del worker (SPEC-171 ya los entregó). Solo orquestación + docs.
- Deploy (CEO): tras merge, en el VPS `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build` levanta `pi-monitor` junto al stack.
