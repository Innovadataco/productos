# SPEC-002 · tasks.md

> **Todas las tareas sin marcar [ ]** — implementación pendiente hasta INSTRUCTIVO-002 real.
> Los Tests 7 y 8 son mandatorios de la enmienda `1eaa214` · REGLA DE ABORTO en Test 8.

## Preparación

- [ ] T-01 · Verificar red Docker PI en VPS: `docker network ls | grep pi` (Jelkin o Fábrica · SSH read-only)
- [ ] T-02 · Anotar nombre exacto de la red PI para `PI_NET_NAME` en `.env.bi.example`
- [ ] T-03 · Verificar que `next.config.ts` tiene `output: 'standalone'` (Dockerfile.next lo necesita)

## docker-compose.bi.yml

- [ ] T-04 · Escribir servicio `bi-superset` (`apache/superset:4.1.0` · puerto 8088 · healthcheck)
- [ ] T-05 · Escribir servicio `bi-vanna` (build Dockerfile.vanna · puerto 8001 · healthcheck)
- [ ] T-06 · Escribir servicio `bi-telegram` (build Dockerfile.telegram · sin puertos · long-polling)
- [ ] T-07 · Escribir servicio `bi-superset-db` (`postgres:16-alpine` · puerto 5434 · healthcheck)
- [ ] T-08 · Escribir servicio `bi-db-replica` (`pgvector/pgvector:pg16` · puerto 5433 · healthcheck · redes: bi-net + pi-net)
- [ ] T-09 · Escribir servicio `bi-next` (build Dockerfile.next · puerto 3001 · healthcheck)
- [ ] T-10 · Declarar red `bi-net` (bridge · nueva) y `pi-net` (external:true · name: ${PI_NET_NAME})
- [ ] T-11 · Declarar 6 volúmenes (bi-superset-home · bi-superset-config · bi-vanna-cache · bi-telegram-config · bi-superset-db-data · bi-db-replica-data)

## Dockerfiles

- [ ] T-12 · Escribir `Dockerfile.vanna` (python:3.12-slim · FastAPI stub · EXPOSE 8001)
- [ ] T-13 · Escribir `docker/vanna/requirements.txt` (fastapi · uvicorn · httpx)
- [ ] T-14 · Escribir `docker/vanna/main.py` (FastAPI stub · solo /health · sin Vanna real)
- [ ] T-15 · Escribir `Dockerfile.telegram` (python:3.12-slim · python-telegram-bot==22.0)
- [ ] T-16 · Escribir `docker/telegram/requirements.txt`
- [ ] T-17 · Escribir `docker/telegram/bot.py` (stub · solo /start · authorized chats check)
- [ ] T-18 · Escribir `Dockerfile.next` (multi-stage node:22-alpine · output standalone)
- [ ] T-19 · Escribir `docker/superset/superset_config.py` (config mínima Fase 1)
- [ ] T-20 · Escribir `docker/superset/init-metadata-db.sql` (vacío · Superset crea schema solo)

## Scripts réplica pg_logical (referencia · Jelkin ejecuta)

- [ ] T-21 · Escribir `scripts/replica-setup/01-pi-db-crear-usuario-replica.sql` (CREATE USER bi_replica · GRANT SELECT · placeholder `<password>`)
- [ ] T-22 · Escribir `scripts/replica-setup/02-pi-db-publicacion.sql` (CREATE PUBLICATION bi_replica · 14 tablas OPERATIVAS · sin Usuario/Password/Session)
- [ ] T-23 · Escribir `scripts/replica-setup/03-bi-db-replica-suscripcion.sql` (CREATE SUBSCRIPTION · placeholder `<password>`)
- [ ] T-24 · Escribir `scripts/replica-setup/04-verificar-replica.sql` (SELECT pg_stat_subscription + Tests 7 y 8 como comentarios guía)
- [ ] T-25 · Escribir `scripts/replica-setup/INSTRUCTIVO-JELKIN-replica.md` (orden exacto · sin valores de contraseñas)

## Otros entregables

- [ ] T-26 · Escribir `INVENTARIO-DE-SECRETOS.md` en raíz del repo (solo nombres de variables · sin valores)
- [ ] T-27 · Actualizar `.env.bi.example` con todas las variables del compose (JWT_SECRET · SUPERSET_DB_* · REPLICA_DB_* · TELEGRAM_BOT_TOKEN · PI_NET_NAME · etc)
- [ ] T-28 · Escribir `scripts/deploy-bi-prod.sh` (SSH Jelkin · set -e · healthchecks post-deploy)

## Gate local

- [ ] T-29 · `docker compose -f docker-compose.bi.yml config` → sin errores YAML
- [ ] T-30 · `docker build -f Dockerfile.next -t bi-next-test .` → sin errores
- [ ] T-31 · `docker build -f Dockerfile.vanna -t bi-vanna-test .` → sin errores
- [ ] T-32 · `bash scripts/ratchets/cero-secretos.sh` → exit 0 (ningún SQL tiene passwords)
- [ ] T-33 · `git diff HEAD -- src/` → CERO cambios en código frontend

## Tests funcionales obligatorios en VPS (enmienda 1eaa214 · Jelkin ejecuta)

- [ ] **T-34 · Test 7 · Paridad master↔réplica** (Jelkin corre en VPS · output pegado en cierre.md):
  ```bash
  psql -h pi-db      -U proteccion -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'
  psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'
  # → ambos counts iguales o réplica ≤ master · lag < 10s
  # Repetir para "Colegio" y "Suscripcion"
  # INSERT en master → esperar 10s → verificar que aparece en réplica
  ```

- [ ] **T-35 · Test 8 · INSERT rechazado por bi_reader** (**REGLA DE ABORTO**):
  ```bash
  psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c \
    "INSERT INTO \"Colegio\" (id, nombre) VALUES ('test', 'test');"
  # → DEBE FALLAR con:
  #   "ERROR: cannot execute INSERT in a read-only transaction"
  #   o "ERROR: permission denied for table Colegio"
  # → Si la réplica ACEPTA el INSERT: PARA inmediato · avisa CEO · NO se emite REALIZADO
  ```

## Push único

- [ ] T-36 · `git add docker-compose.bi.yml Dockerfile.* docker/ scripts/ INVENTARIO-DE-SECRETOS.md .env.bi.example next.config.ts`
- [ ] T-37 · `git status` → verificar que solo toca archivos SPEC-002 · cero en `src/`
- [ ] T-38 · `git commit -m "feat(bi): SPEC-002 Docker Compose BI + réplica pg_logical · INSTRUCTIVO-002"`
- [ ] T-39 · `git push origin feature/bi-scaffolding`
- [ ] T-40 · Señal: `bi-dev-2: BI-SPEC-002 · REALIZADO · <hash> · output tests 7+8 en cierre.md`

---

## Criterios de aceptación (Fábrica BI-2)

- [ ] `docker compose -f docker-compose.bi.yml config` sin errores
- [ ] 6 servicios con healthcheck
- [ ] `Dockerfile.next` con `output: 'standalone'`
- [ ] `.env.bi.example` sin secretos reales
- [ ] SQL replica-setup sin contraseñas hardcoded (solo placeholders)
- [ ] `INVENTARIO-DE-SECRETOS.md` creado
- [ ] Tests 7 y 8 ejecutados con output literal en `cierre.md`
- [ ] `git diff HEAD -- src/` muestra CERO cambios

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 (reconstruida desde cero en SPEC-005 · I-04) |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ implementación pendiente |
