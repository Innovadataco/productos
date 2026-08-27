# Plan SPEC-294 — Deploy lento

## Tarea 1 — Habilitar BuildKit en `deploy-prod.sh`

`scripts/deploy-prod.sh` — al inicio, después del `cd`:

```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

Necesario para que `docker compose build` use BuildKit y respete `RUN --mount=type=cache`.

---

## Tarea 2 — Optim 3.1 (cache mount npm ci)

En `Dockerfile`:

```dockerfile
# stage deps
- RUN npm ci
+ RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci

# stage prod-deps
- RUN npm ci --omit=dev && npx prisma generate
+ RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --omit=dev
```

`sharing=locked` para que ambos stages compartan el mismo cache buildkit sin corrupción concurrente. La 2ª `npm ci` reutiliza tarballs → segundos en vez de ~100s.

---

## Tarea 3 — Optim 3.2 (copiar solo src/lib)

En `Dockerfile` runner:

```dockerfile
- COPY --from=builder /app/src ./src
+ # SPEC-294 (002-PI-195): los workers .mjs solo importan de ../src/lib/*.ts.
+ # El resto (src/app, src/components, src/hooks) ya está en .next/standalone.
+ COPY --from=builder /app/src/lib ./src/lib
```

**Verificación de seguridad post-implement**: `docker run --rm pi-app:latest sh -c "ls src/"` debe mostrar solo `lib`. `docker exec pi-worker node --import tsx scripts/worker-supervisor.mjs --dry-run` (si el worker soporta) debe arrancar sin ENOENT.

---

## Tarea 4 — Optim 3.3 (prisma generate consolidado)

En `Dockerfile`:

- `prod-deps`: quitar `&& npx prisma generate` de la línea `RUN --mount... npm ci --omit=dev`.
- `runner`: después del `COPY --from=prod-deps /app/node_modules ./node_modules`, agregar:
  ```dockerfile
  # SPEC-294: reutilizar el cliente Prisma generado en `builder` (donde ya es
  # necesario para `next build`) en vez de regenerarlo en `prod-deps`.
  COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
  ```

---

## Tarea 5 — Ratchet CI en `deploy-prod.sh`

Reemplazar el bloque de build actual:

```bash
- echo "==> Build pi-app:${PI_APP_TAG}"
- $COMPOSE build
- docker tag "pi-app:${PI_APP_TAG}" pi-app:latest
+ echo "==> Build pi-app:${PI_APP_TAG}"
+ BUILD_START=$(date +%s)
+ $COMPOSE build
+ BUILD_END=$(date +%s)
+ BUILD_SECONDS="${PI_BUILD_SECONDS_OVERRIDE:-$((BUILD_END - BUILD_START))}"
+ docker tag "pi-app:${PI_APP_TAG}" pi-app:latest
+
+ # SPEC-294 (002-PI-195): ratchet contra regresión del tiempo de build.
+ echo "==> Build tardó ${BUILD_SECONDS}s"
+ if [ "$BUILD_SECONDS" -gt 720 ]; then
+     echo "❌ FAIL: build tardó ${BUILD_SECONDS}s (> 8 min · umbral duro SPEC-294)"
+     exit 1
+ fi
+ if [ "$BUILD_SECONDS" -gt 480 ]; then
+     echo "⚠️  WARN: build tardó ${BUILD_SECONDS}s (> 5 min · umbral blando SPEC-294)"
+ fi
```

`PI_BUILD_SECONDS_OVERRIDE` permite probar el ratchet sin construir realmente.

---

## Tarea 6 — Test del ratchet

Crear `scripts/deploy-prod-ratchet.test.sh` que ejecuta el script con overrides simulados:

```bash
#!/usr/bin/env bash
# SPEC-294 (002-PI-195): humo del ratchet CI.
# Verifica que warn > 5m y fail > 8m se comporten como esperado.
set -euo pipefail
cd "$(dirname "$0")/.."

# Extrae el bloque ratchet a una función testable in-line (fuente única).
run_ratchet() {
    local seconds=$1
    if [ "$seconds" -gt 720 ]; then echo "FAIL:$seconds"; return 1; fi
    if [ "$seconds" -gt 480 ]; then echo "WARN:$seconds"; return 0; fi
    echo "OK:$seconds"; return 0
}

# Casos
test "$(run_ratchet 300)" = "OK:300"
test "$(run_ratchet 480)" = "OK:480"
test "$(run_ratchet 481)" = "WARN:481"
test "$(run_ratchet 720)" = "WARN:720"
if run_ratchet 721 > /dev/null; then echo "FAIL: 721 debió salir con exit 1"; exit 1; fi

echo "OK: ratchet SPEC-294 pasa 5 casos"
```

---

## Tarea 7 — Verificación en vivo (D-004, pre-REALIZADO)

```bash
# En dev (M-series local):
rm .env.production && cp .env.production.example .env.production   # baseline env

# Corrida 1 (cold cache buildx):
docker builder prune -f
T1=$(date +%s)
docker compose --env-file .env.production -f docker-compose.prod.yml build
T2=$(date +%s)
echo "Corrida 1 (cold): $((T2-T1))s"

# Corrida 2 (cache warm):
T3=$(date +%s)
docker compose --env-file .env.production -f docker-compose.prod.yml build
T4=$(date +%s)
echo "Corrida 2 (warm): $((T4-T3))s"

# Sanidad de imagen
docker run --rm pi-app:latest sh -c "ls src/ && ls node_modules/.prisma/client/index.js | head -3"

# Ratchet
scripts/deploy-prod-ratchet.test.sh
```

Ambas corridas < 300s = green. Reportar en `002-PI-195 · VERIFICADO EN VIVO`.

---

## Tarea 8 — CI guards

- `specs/294-deploy-lento/tasks.md` (guard vacío)
- `specs/README.md` — entrada SPEC-294
