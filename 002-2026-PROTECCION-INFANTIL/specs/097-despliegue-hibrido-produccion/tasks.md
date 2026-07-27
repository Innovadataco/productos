# Tasks — Spec 097: Despliegue híbrido a producción (VPS + cerebro en la Mac)

## Fase 0 — Artefactos de repo

- [ ] T001 [P] `output: "standalone"` en `next.config.ts` (no afecta dev).
- [ ] T002 [P] `Dockerfile` multi-stage (node:22-alpine: deps → build → runner no-root; CMD app Next standalone; entrada worker vía `command` override) + `.dockerignore`.
- [ ] T003 [P] `docker-compose.prod.yml`: app (5005→3000 en 127.0.0.1), worker, db (pgvector/pgvector:pg16, volumen `pi_postgres_data`, puerto 5434 en 127.0.0.1 o solo red interna), `restart: always`, healthcheck db, env_file `.env.production`.
- [ ] T004 [P] `scripts/deploy-prod.sh`: `git pull` + build con tag por commit + `docker compose -f docker-compose.prod.yml up -d` + `migrate deploy`.

**Gate F0**: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` (en la Mac, verifica que standalone no rompe nada).

## Fase 1 — US1/US2: VPS base (sin tocar Gesmovil)

- [ ] T010 US1: snapshot de estado Gesmovil (ss -tlnp, systemctl, pm2) como línea base; swap 4G (fallocate, chmod 600, mkswap, swapon, fstab, vm.swappiness=10); verificar Gesmovil.
- [ ] T011 US1: ufw — revisar reglas actuales (`ufw status numbered`); SOLO añadir lo que falte para 22/80 (y lo que Gesmovil use); PI no abre puertos; verificar Gesmovil + SSH vivo.
- [ ] T012 US2: instalar Docker Engine + compose plugin (repo oficial); `docker info` OK; verificar Gesmovil.

## Fase 2 — US3/US4/US5: PI en contenedores + cerebro híbrido

- [ ] T020 US4: deploy key read-only del repo en el VPS (generar par en VPS, agregar con `gh repo deploy-key` desde la Mac); clone a `/opt/proteccion-infantil/repo`.
- [ ] T021 US4: `.env.production` (600, root) con secretos fuertes (`openssl rand -hex 32`): DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, PARAM_ENCRYPTION_KEY, WORKER_SECRET, RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_APP_URL=https://pi.innovadataco.com, OLLAMA_BASE_URL=http://100.91.87.86:11434, DISABLE_RATE_LIMIT ausente/false. Registrar las 2 claves de cifrado para entrega al CEO.
- [ ] T022 US5: en la Mac, exponer Ollama SOLO a la tailnet (`tailscale serve` tcp 11434 → localhost:11434, sin Funnel); desde el VPS verificar `curl http://100.91.87.86:11434/api/tags`; verificar que Ollama NO quedó en 0.0.0.0 público.
- [ ] T023 US3: build en VPS (`docker compose -f docker-compose.prod.yml build`) con tag por commit; up; `migrate deploy` + seed limpio; healthcheck `curl localhost:5005/api/health`.
- [ ] T024 US3: verificar worker vivo (advisory lock, logs) y que Gesmovil sigue intacto.

## Fase 3 — US6: Exposición restringida

- [ ] T030 US6: ingress `pi.innovadataco.com → http://localhost:5005` en `/etc/cloudflared/config.yml` (sin tocar rutas hermes); restart cloudflared correspondiente; `cloudflared tunnel route dns <tunnel> pi.innovadataco.com`; verificar MX intactos (`dig MX innovadataco.com`).
- [ ] T031 US6: verificar HTTPS responde con candado y que el acceso queda restringido (login de la app; Cloudflare Access en dashboard = pendiente CEO si no hay API token — registrar).

## Fase 4 — US7/US8 + verificación E2E + cierre

- [ ] T040 US7/US8: `docs/despliegue/produccion-vps.md` — arquitectura, deploy (US7), rollback (imágenes por tag + migraciones aditivas), runbook (logs, reinicios, qué hacer si la Mac se apaga).
- [ ] T041: verificación E2E — reporte de prueba en prod viaja VPS → Tailscale → Ollama Mac → clasificado (revisar logs worker + estado del reporte); Gesmovil vivo al final.
- [ ] T042: gate final (lint+test+tsc+build en Mac) + healthcheck VPS + `specs/097-despliegue-hibrido-produccion/cierre.md` (evidencias, claves entregadas al CEO, pendientes como Cloudflare Access) + sección Implementación en spec.md (Status → IMPLEMENTADO pendiente ACTA) + specs/README.md.
- [ ] T043: commits (staging explícito solo rutas del 002) + push a `feature/001-scaffolding`.
