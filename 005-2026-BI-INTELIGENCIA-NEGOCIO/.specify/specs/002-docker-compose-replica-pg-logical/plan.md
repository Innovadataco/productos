# SPEC-002 · plan.md

## Decisiones técnicas

| ID | Decisión | Razón |
|---|---|---|
| D-11 | Docker Compose BI separado (`docker-compose.bi.yml`) · red `bi-net` propia · env-file `.env.bi.production` propio | Aislamiento deploy · evita acoplar con PI · deploy independiente sin riesgo |
| D-12 | Postgres réplica read-only vía **pg_logical replication** (no pg_basebackup streaming) | Fase 2 requiere datos frescos (1-5s lag) para chat en vivo y dashboards · dump nightly no sirve · pg_logical es la opción de PI sin impacto en WAL |
| D-13 | Puertos: Superset 8088 · Vanna 8001 · Réplica 5433 · Superset-DB 5434 · Next 3001 | Puertos VPS verificados libres · no colisión con PI (PI usa 3000 · 5432) |
| D-14 | SSL vía **Cloudflare Tunnel** (no Certbot) · entry `tablero.pi.innovadataco.com` → `127.0.0.1:3001` · tunnel-id `970b8bb9-3931-42a3-a452-67329a56bae8` | PI ya usa cloudflared · reutilizar reduce complejidad · CNAME automático |
| D-16 | SSO por **JWT compartido** con PI (mismo `JWT_SECRET`) · BI valida token · sin cambios en PI | Cero fricción · auth propio sobredimensionado para Fase 1 interno |
| D-20 | Réplica excluye tablas PII: `Usuario` · `Password` · `Session` · publicación con lista explícita de 14 tablas OPERATIVAS | Privacidad menores · candado 13 (sanitizer PII) · Ley 1581 |

---

## Plan de implementación (pasos a ejecutar en INSTRUCTIVO-002)

### Paso 1 · Verificar red Docker PI en VPS (candado 15 · antes de escribir compose)

```bash
# SSH al VPS (Jelkin o Fábrica · read-only)
docker network ls | grep pi
# Anotar nombre exacto: típicamente "proteccion-infantil_pi-net" o similar
# → este nombre va en PI_NET_NAME en .env.bi.example y en el compose
```

Desarrollo NO tiene SSH VPS. Jelkin ejecuta este paso y pega el output en el INSTRUCTIVO antes de dar la señal REVISO. Si el nombre no está disponible, dejar `PI_NET_NAME=REEMPLAZAR_CON_NOMBRE_RED_DOCKER_DE_PI` como placeholder en `.env.bi.example`.

### Paso 2 · Escribir docker-compose.bi.yml

6 servicios con healthchecks obligatorios. `bi-db-replica` se une a `bi-net` y a `pi-net` (external:true con `name: ${PI_NET_NAME}`). El valor real de `PI_NET_NAME` lo provee Jelkin.

### Paso 3 · Dockerfile.vanna (stub Fase 1)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY docker/vanna/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY docker/vanna/ .
EXPOSE 8001
CMD ["python", "main.py"]
```

`docker/vanna/requirements.txt`: `fastapi==0.115.0`, `uvicorn[standard]==0.30.0`, `httpx==0.27.0`. Vanna real en SPEC-003.

### Paso 4 · Dockerfile.telegram (stub Fase 1)

`python:3.12-slim` + `python-telegram-bot==22.0`. Bot stub solo `/start`. Completo en SPEC-004.

### Paso 5 · Dockerfile.next (multi-stage · standalone)

```dockerfile
FROM node:22-alpine AS builder
# ... npm ci + npm run build
FROM node:22-alpine AS runner
# ... copy .next/standalone
EXPOSE 3000
CMD ["node", "server.js"]
```

**Requiere `output: 'standalone'` en `next.config.ts`** (ajuste a SPEC-001 si no está ya). Verificar antes de implementar.

### Paso 6 · scripts/replica-setup/ (4 SQL + instructivo Jelkin)

SQL con placeholders `<password>` — nunca valores reales. Ratchet 2 detecta secretos hardcoded. El INSTRUCTIVO-JELKIN-replica.md detalla el orden exacto sin valores de contraseñas.

### Paso 7 · INVENTARIO-DE-SECRETOS.md

Lista de variables en raíz del repo. Solo nombres, nunca valores. Ver sección L del INSTRUCTIVO-002.

### Paso 8 · deploy-bi-prod.sh

Script SSH para Jelkin. `set -e` + healthchecks post-deploy. Bloqueado para IA por classifier.

### Paso 9 · Gate local

```bash
docker compose -f docker-compose.bi.yml config   # valida YAML sintaxis
# Verificar que next.config.ts tiene output: 'standalone'
docker build -f Dockerfile.next -t bi-next-test .   # sin errores
docker build -f Dockerfile.vanna -t bi-vanna-test . # sin errores
# Verificar que SQL no tienen contraseñas hardcoded:
bash scripts/ratchets/cero-secretos.sh
```

### Paso 10 · Push único

```bash
git add docker-compose.bi.yml Dockerfile.* docker/ scripts/ INVENTARIO-DE-SECRETOS.md .env.bi.example next.config.ts
git status  # verificar
git commit -m "feat(bi): SPEC-002 Docker Compose BI + réplica pg_logical · INSTRUCTIVO-002"
git push origin feature/bi-scaffolding
```

### Paso 11 · Tests funcionales en VPS (Jelkin ejecuta · Desarrollo pega output en cierre.md)

Test 7 (paridad master↔réplica) y Test 8 (INSERT rechazado) de la enmienda `1eaa214`. Output literal en `cierre.md`. Sin estos tests verificados no se emite REALIZADO.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 (reconstruida desde cero en SPEC-005 · I-04) |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ implementación pendiente |
