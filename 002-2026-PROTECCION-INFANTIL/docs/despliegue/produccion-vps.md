# Despliegue de producción — VPS Hostinger + cerebro en la Mac (spec 097)

Arquitectura híbrida (ACTA_ARQ_02 §2.4, D-25/D-26):

```text
internet
   │  HTTPS (solo subdominio pi.innovadataco.com)
   ▼
Cloudflare Tunnel (servicio cloudflared-hermes, tunnel "hermes" — ya existía)
   │  http://<IP-INTERNA>:5005 (SOLO localhost)
   ▼
VPS Hostinger (Docker)                    Mac Studio (cerebro IA)
├─ pi-app    (Next.js standalone :3000)   Ollama :<PUERTO-OLLAMA> (localhost)
├─ pi-worker (pg-boss, UN worker)              ▲
├─ pi-monitor (vigilante infra: 6 probes →    │ SOLO tailnet
│   HealthProbe, incidentes + email)          │ tailscale serve --tcp=<PUERTO-OLLAMA>
├─ pi-db     (Postgres+pgvector)               │ (<IP-TAILNET-MAC>, Mac)
│     └─ red interna de Docker, SIN puerto     │ tailscale serve --tcp=<PUERTO-OLLAMA>
│        publicado al host                     │ (<IP-TAILNET-MAC>, Mac)
└─ OLLAMA_BASE_URL=http://<IP-TAILNET-MAC>:<PUERTO-OLLAMA> ──┘
```

**Convivencia con Gesmovil (intocable)**: Apache :80, Node 3000/5050 (pm2),
Postgres <IP-INTERNA>:5432, hermes 8642/9119. PI no publica NINGÚN puerto al host salvo
<IP-INTERNA>:5005; su Postgres vive solo en la red interna de Docker.

## Rutas

- Repo en el VPS: `/opt/proteccion-infantil/repo` (clone de `Innovadataco/productos`,
  rama `main`, deploy key read-only).
- App: `/opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL`.
- Secretos: `.env.production` (600, root) SOLO en el VPS — nunca en git.
  Respaldo de `ENCRYPTION_KEY` y `PARAM_ENCRYPTION_KEY`: con el CEO (fuera del VPS).

## Deploy (US7)

```bash
ssh pi-vps
cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL
./scripts/deploy-prod.sh
```

Hace: `git pull --ff-only` → build etiquetado `pi-app:<sha>` (+ `latest`) →
`docker compose --env-file .env.production -f docker-compose.prod.yml up -d` →
`prisma migrate deploy` → healthcheck `http://<IP-INTERNA>:5005/api/health`.

CI/CD automático: fuera de alcance (pendiente futuro).

## Rollback (US8)

Las migraciones son SIEMPRE aditivas: revertir el código nunca requiere revertir la BD.

```bash
cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL
docker images pi-app                                    # tags disponibles (sha de commits)
PI_APP_TAG=<sha-anterior> ./scripts/deploy-prod.sh --skip-pull
```

`--skip-pull` no toca git: levanta la imagen del tag anterior y corre `migrate deploy`
(no-op si la BD ya tiene todas las migraciones). Para volver a `latest`:
`./scripts/deploy-prod.sh`.

## Runbook

- Estado: `docker compose --env-file .env.production -f docker-compose.prod.yml ps`
- Logs: `docker logs pi-app --tail 50` · `docker logs pi-worker --tail 50` · `docker logs pi-monitor --tail 50` · `docker logs pi-db --tail 20`
- Reinicio: `docker compose --env-file .env.production -f docker-compose.prod.yml restart app worker`
  (todos los servicios tienen `restart: always`: sobreviven reboot del VPS).
- **Monitor (SPEC-171/178)**: el servicio `pi-monitor` corre el vigilante de infraestructura (6 probes → tabla `HealthProbe`, incidentes + email throttled). Verificar que escribe:
  `docker exec pi-db psql -U proteccion proteccion_infantil -c 'SELECT senal, ok, "creadoEn" FROM "HealthProbe" ORDER BY "creadoEn" DESC LIMIT 6'`
  (filas con `creadoEn` reciente = vivo). Si el tablero operativo muestra semáforos vacíos, revisar `docker logs pi-monitor`.
- Backup BD: `docker exec pi-db pg_dump -U proteccion proteccion_infantil | gzip > pi-$(date +%F).sql.gz`
- Si la Mac se apaga: el worker detecta Ollama caído (healthcheck previo a cada job) y
  reintenta con backoff; los reportes quedan PENDIENTE hasta que la tailnet vuelva.
- Gesmovil vivo (verificación): `systemctl is-active apache2 postgresql@16-main`;
  `pm2 list`; `ss -tln | grep -E ':(80|3000|5050|5432|8642|9119) '`.

## Blindajes (adición de seguridad 002-PI-012)

1. **BD de PI no expuesta**: sin `ports:` en el servicio db; solo red interna de Docker.
   Verificar: `docker port pi-db` → vacío.
2. **Ollama solo tailnet**: en la Mac, Ollama escucha en `localhost:<PUERTO-OLLAMA>` y
   `tailscale serve --bg --tcp=<PUERTO-OLLAMA> tcp://localhost:<PUERTO-OLLAMA>` lo expone SOLO a la tailnet
   (sin Funnel). Verificado: `curl http://<IP-PUBLICA-MAC>:<PUERTO-OLLAMA>` → timeout.
   ACL recomendada en el admin console de Tailscale (acción del CEO, dueño de la tailnet):
   permitir `<IP-TAILNET-VPS> (VPS) → mac-studio-de-idc:<PUERTO-OLLAMA>` y denegar el resto.
3. **SSH solo por llave**: drop-in preparado en
   `/etc/ssh/sshd_config.d/60-pi-hardening.conf.PENDIENTE` (PasswordAuthentication no,
   PermitRootLogin prohibit-password). Se aplica SOLO con confirmación del CEO:
   `mv .../60-pi-hardening.conf.PENDIENTE .../60-pi-hardening.conf && systemctl reload ssh`.
