# Implementation Plan: SPEC-178 — Hotfix I-58 (arranque del monitor en prod)

**Branch**: `work/002-pi-nocturno-20260817` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

---

## Cambios exactos

### 1. `docker-compose.prod.yml` — nuevo servicio (patrón del servicio `worker`)

```yaml
  monitor:
    image: pi-app:${PI_APP_TAG:-latest}
    container_name: pi-monitor
    restart: always
    env_file: .env.production
    # SPEC-171/178: el vigilante de infraestructura (6 probes → HealthProbe,
    # incidentes + email throttled). Advisory lock: exactamente uno.
    command: node --import tsx scripts/monitor-probes.mjs
    environment:
      WORKER_RUN_DIR: /app/run
      API_BASE_URL: http://app:3000
    volumes:
      - pi_worker_run:/app/run   # lee el heartbeat del worker (señal "worker")
    depends_on:
      db:
        condition: service_healthy
      app:
        condition: service_started
```

### 2. Docs de despliegue

- `docs/despliegue/produccion-vps.md`: mención del servicio `monitor` (qué hace, verificación: `docker compose ps` + `SELECT senal, ok, creadoEn FROM "HealthProbe" ORDER BY "creadoEn" DESC LIMIT 6`).

### 3. Prueba local (evidencia para el cierre)

1. `npm run dev` (o `next start` tras build) + BD de dev.
2. Arrancar el monitor: `node --env-file=.env --import tsx scripts/monitor-probes.mjs` durante ~2 min.
3. Verificar filas frescas en `HealthProbe` por psql (senal + creadoEn reciente).
4. Verificar que un segundo monitor sale con código 2 (advisory lock).
5. Confirmar en fuente (ya hecho) que `motor-deriva-semanal` está registrado con `boss.schedule` + `boss.work` en `worker-reportes.mjs:502-504`.

### 4. Verificación

- `docker compose -f docker-compose.prod.yml config` renderiza sin errores.
- `node --check scripts/monitor-probes.mjs` (ya verde).
- Gate: arch:check + unit + build (cero cambios de código de app).

## Fuera de alcance

- No se toca el supervisor (queda solo con el worker de reportes — proceso separado, restart independiente).
- No se cambia el código del monitor (SPEC-171 ya lo entregó con advisory lock, throttle y purga).
