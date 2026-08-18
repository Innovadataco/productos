# Tasks: SPEC-178 — Hotfix I-58 (arranque del monitor en prod)

**Input**: `specs/178-monitor-arranque-prod/{spec,plan}.md` · **Compuerta §4**: PENDIENTE de ZEUS (cambio de arranque/infra).

- [ ] **T001** `docker-compose.prod.yml`: servicio `monitor` (patrón del worker; volumen `pi_worker_run`; `depends_on` db+app; `command: node --import tsx scripts/monitor-probes.mjs`).
- [ ] **T002** `docs/despliegue/produccion-vps.md`: sección del servicio monitor (qué hace + cómo verificarlo).
- [ ] **T003** Prueba local: monitor corriendo ~2 min → filas frescas en `HealthProbe` (evidencia con SELECT) + segundo arranque sale con código 2 (advisory lock).
- [ ] **T004** Confirmar en cierre que `motor-deriva-semanal` está registrado en el arranque del worker (ya verificado en fuente: `worker-reportes.mjs:502-504`).
- [ ] **T005** `docker compose -f docker-compose.prod.yml config` sin errores + gate local + commit + push a `work/002-pi-nocturno-20260817` (actualiza PR #55).
- [ ] **T006** `cierre.md` + fila en `specs/README.md` (2 tablas).
