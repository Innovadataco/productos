# Research — Spec 097

## Estado verificado (2026-07-26)

**VPS (`pi-vps` = root@2.25.77.158, srv1803342, Ubuntu 24.04, 8 GB, 96 GB disco al 11%)**
- Sin swap (`swapon --show` vacío).
- Puertos: 80 apache2, 22 sshd, 3000 y 5050 node (pm2 `backend`, 11 días up), 5432 postgres
  16-main en 0.0.0.0 (DE GESMOVIL — no tocar), 8642/9119 hermes, cloudflared
  (servicio `cloudflared-hermes`, config `/etc/cloudflared/config.yml`).
- ufw: activo (revisar reglas completas antes de tocar — output truncado mostraba 5432 allow).
- Sin Docker. Tailscale activo: VPS = 100.113.13.77.
- Servicios gesmovil: apache2, postgresql@16-main, hermes-{dashboard,gateway,workspace},
  cloudflared-hermes, tailscaled; pm2 `backend` (root).

**Mac Studio (`mac-studio-de-idc`, 100.91.87.86)**
- Tailscale.app corriendo; `tailscale serve` disponible, sin config previa.
- Ollama local :11434 con los modelos (gemma2:27b, qwen2.5:14b, aya-expanse:32b, ornith:9b,
  nomic-embed-text).
- `gh` autenticado como Innovadataco (para agregar deploy key al repo).

**Repo**
- `next.config.ts` SIN `output: "standalone"` → se agrega (requerido para imagen liviana).
- `docker-compose.yml` dev solo tiene db (pgvector/pgvector:pg16 en 5433).
- Worker: `scripts/worker-reportes.mjs` (node --env-file, advisory lock = UN worker).
- Seed: `prisma/seed.ts` idempotente (upserts) — seguro para BD limpia de prod.
- App en puerto 5005; en contenedor correrá en 3000 interno, mapeado a 127.0.0.1:5005.

## Decisiones

- **Imagen**: multi-stage node:22-alpine; `server.js` standalone de Next en runner;
  worker = misma imagen con `command` distinto (node scripts/worker-reportes.mjs).
- **Ollama tailnet-only**: `tailscale serve --bg --tcp=11434 tcp://localhost:11434` en la
  Mac (Serve ≠ Funnel: solo tailnet). Ollama sigue en localhost; nada escucha en 0.0.0.0.
- **DB de PI**: contenedor pgvector:pg16, puerto 5434 en 127.0.0.1 (backups/debug) y red
  interna para app/worker. NUNCA 5432.
- **Cloudflare Access**: no hay API token en el VPS; la política Access es acción de
  dashboard (pendiente CEO). Barrera efectiva inmediata: login de la app (no hay registro
  público abierto para roles admin; la consulta pública sigue siendo anónima por diseño —
  riesgo registrado para ZEUS: decidir si la consulta pública queda también tras Access).
