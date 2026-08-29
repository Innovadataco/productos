# Implementation Plan: Spec 097 — Despliegue híbrido a producción

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

## Summary

Publicar PI en el VPS Hostinger (que ya corre Gesmovil) con Docker: app Next.js standalone +
worker + Postgres/pgvector propios (puerto 5434/red interna), Ollama consumido desde la Mac
Studio SOLO por Tailscale (`tailscale serve` en la Mac, nunca 0.0.0.0), exposición
restringida de pi.innovadataco.com por el Cloudflare Tunnel existente, secretos fuertes
fuera de git entregados al CEO, BD limpia con seed, y scripts de deploy/rollback
documentados. Verificación de Gesmovil vivo tras cada paso.

## Diseño

1. **Repo**: `output: "standalone"` en `next.config.ts`; `Dockerfile` multi-stage
   (deps → build → runner node:22-alpine, usuario no-root, app + entrada worker);
   `.dockerignore`; `docker-compose.prod.yml` (app:5005→3000 solo localhost, worker,
   db pgvector:pg16 con volumen, `restart: always`, healthcheck db); `scripts/deploy-prod.sh`.
2. **VPS (US1)**: swapfile 4G + fstab + swappiness 10; ufw: revisar reglas actuales y solo
   AÑADIR lo necesario (nada que cierre 22/80/3000/5050/8642/9119; PI no abre puertos —
   5005 queda en 127.0.0.1). Verificación Gesmovil tras cada paso (ss + systemctl + pm2).
3. **VPS (US2)**: Docker Engine oficial (apt repo docker.com) + compose plugin; `docker info`.
4. **VPS (US3/US4)**: `/opt/proteccion-infantil` con clone del repo (deploy key read-only
   agregada con `gh` desde la Mac), `.env.production` SOLO en el VPS (permisos 600),
   secretos generados con `openssl rand -hex 32`; build con tag por commit
   (`pi-app:<sha>` + `pi-app:latest`); `migrate deploy` + `db seed` limpio.
5. **Mac (US5)**: `tailscale serve --bg --tcp 11434 tcp://localhost:11434` (tailnet-only,
   sin Funnel); desde el VPS `curl http://100.91.87.86:11434/api/tags`; `OLLAMA_BASE_URL`
   en el env de prod.
6. **VPS (US6)**: agregar ingress `pi.innovadataco.com → http://localhost:5005` al
   `/etc/cloudflared/config.yml` existente (SIN tocar las rutas de hermes), restart del
   servicio cloudflared correspondiente, `cloudflared tunnel route dns` para el subdominio
   (CNAME, no toca MX). Acceso restringido: Cloudflare Access (dashboard — pendiente CEO si
   no hay API token) + login de la app como barrera mínima ya existente.
7. **Docs (US7/US8)**: `docs/despliegue/produccion-vps.md` con arquitectura, deploy,
   rollback (tag anterior + migrate deploy, migraciones siempre aditivas) y runbook.

## Contratos / datos

- Sin cambios de schema Prisma (migraciones existentes, aditivas, se aplican con `migrate deploy`).
- Artefactos nuevos en repo: `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`,
  `scripts/deploy-prod.sh`, `docs/despliegue/produccion-vps.md`.
- Secretos: NUNCA en git (`.env.production` solo en VPS, 600 root).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Romper Gesmovil | Verificación tras cada paso; ufw solo aditivo; PI sin puertos públicos; Postgres de PI en 5434/interno |
| Ollama expuesto a internet | Solo tailnet (serve sin Funnel); verificar que no escucha en 0.0.0.0 |
| Build de Next.js en 2 CPU/8 GB | Swap 4G primero; build con `NODE_OPTIONS=--max-old-space-size=4096` |
| Subdominio afecta correo | `cloudflared tunnel route dns` crea SOLO el CNAME del subdominio; MX intactos (verificar con dig) |
| Claves solo en el VPS | Entrega al CEO para respaldo externo (en cierre.md + reporte) |
