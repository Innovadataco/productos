# Quickstart — Spec 097: verificación del despliegue híbrido

## A. Gesmovil intacto (tras cada fase)

```bash
ssh pi-vps 'ss -tlnp | grep -E ":(80|3000|5050|5432|8642|9119) " ; systemctl is-active apache2 postgresql@16-main cloudflared-hermes; pm2 list | grep backend'
```
Esperado: todos los puertos escuchando, servicios `active`, pm2 backend `online`.

## B. VPS base

```bash
ssh pi-vps 'swapon --show; free -h | head -2'          # swap 4G activo
ssh pi-vps 'docker info | head -5; docker compose version'
```

## C. PI en contenedores

```bash
ssh pi-vps 'cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL && docker compose -f docker-compose.prod.yml ps'
ssh pi-vps 'curl -s http://127.0.0.1:5005/api/health'   # {"status":"ok",...}
ssh pi-vps 'docker logs pi-worker --tail 5'             # worker con advisory lock
```

## D. Cerebro híbrido

```bash
ssh pi-vps 'curl -s http://100.91.87.86:11434/api/tags | head -c 200'   # modelos de la Mac vía tailnet
# En la Mac: Ollama NO expuesto público
lsof -iTCP:11434 -sTCP:LISTEN   # solo localhost
```

## E. Exposición restringida

```bash
curl -sI https://pi.innovadataco.com | head -3          # 200/302 HTTPS con candado (Cloudflare)
dig +short MX innovadataco.com                          # MX de Google intactos
```

## F. E2E reporte (VPS → Tailscale → Ollama Mac → VPS)

1. Crear un reporte de prueba vía `POST /api/reportes` en https://pi.innovadataco.com
   (o `curl` al 5005 del VPS con el body del quickstart de la spec de reportes).
2. Ver en los logs del worker del VPS que procesa y clasifica (llamadas OLLAMA a
   100.91.87.86) y el reporte queda CLASIFICADO/REVISION_MANUAL.
3. Borrar el reporte de prueba si se requiere BD limpia (o dejarlo marcado).

## G. Rollback

Ver `docs/despliegue/produccion-vps.md` §Rollback: `docker compose -f docker-compose.prod.yml up -d`
con el tag anterior (imágenes por commit) + `migrate deploy` (migraciones siempre aditivas).
