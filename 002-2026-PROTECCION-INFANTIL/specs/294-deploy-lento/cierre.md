# Cierre SPEC-294 · Deploy lento

## Baseline medido antes

| Entorno | Config | Tiempo | Fuente |
|---------|--------|-------:|--------|
| VPS prod | classic builder (deploy #3 `df44d923`) | 563s (9m30s) | Fábrica |
| Dev local (M-series) | classic builder, cold | 306s (5m6s) | este worktree |

Etapas dominantes en el VPS (Fábrica):
- `npm ci ×2` (deps + prod-deps) = 206s (duplicación con mismo lock hash)
- `next build` = 113s (normal para Next 16)
- `COPY /app/src` en runner = 71s (peso muerto post standalone)
- `prisma generate ×2` = 30-60s
- exports/layer flush = ~130s

## Fixes aplicados

### 1. BuildKit cache mount de `npm ci`
`Dockerfile` stages `deps` y `prod-deps`: `RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci ...`  
`deploy-prod.sh`: `export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1`

Rechacé reutilizar `node_modules` completo entre stages: `deps` lleva devDeps (necesario para `next build`), `prod-deps` corre `--omit=dev`. Compartir tarballs es el punto correcto.

### 2. `COPY /src` → `COPY /src/lib`
`Dockerfile` runner: sustituido `COPY --from=builder /app/src ./src` por `COPY --from=builder /app/src/lib ./src/lib`.

Verificación previa (grep exhaustivo `scripts/*.mjs`): los workers `.mjs` solo importan de `../src/lib/*.ts`. Cero imports de `src/app`, `src/components`, `src/hooks`. La layer explícita bajó de ~12M a 5.9M.

Nota: `du src/` dentro del runner sigue mostrando `src/app`, `src/components`, `src/hooks` porque `.next/standalone` de Next 16 incluye `src/` completo dentro del bundle (para path aliases). Eso ya venía copiado por la layer standalone; no lo duplico.

### 3. Prisma generate consolidado
`Dockerfile`: quitado `&& npx prisma generate` de `prod-deps`. En `runner`, después de `COPY --from=prod-deps /app/node_modules ./node_modules`, añadido `COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma`. Reutiliza el cliente generado en `builder` (donde ya se necesitaba para `next build`).

### 4. Ratchet CI en `deploy-prod.sh`
Nuevo bloque que mide `BUILD_SECONDS = BUILD_END - BUILD_START` (o `PI_BUILD_SECONDS_OVERRIDE` para tests), imprime, y aplica: WARN > 480s, FAIL (exit 1) > 720s. Testado con `scripts/deploy-prod-ratchet.test.sh` (5 casos: 100, 480, 481, 720, 721) — todos verdes.

## Medición después (dev local M-series, buildx docker-container driver)

| Corrida | Config | Tiempo | Δ vs baseline |
|---------|--------|-------:|--------------:|
| Cold (buildx fresh, sin cache buildkit) | buildx | **199s** | −107s (−35%) |
| Warm (cache buildkit + layers cached) | buildx | **90s** | −216s (−70%) |
| Sanity imagen | `docker run pi-app:test-warm ...` | src/lib presente, .prisma cliente carga, node OK | ✓ |

Etapas por buildkit (cold, top-5): `next build`=81.6s · `npm ci (prod-deps)`=66.3s · alpine pull=28.4s · `npm ci (deps)`=28.2s · export/tarball=18.9s.

## Proyección VPS

Baseline VPS = 563s. Reducción proporcional 35% conservadora ⇒ ~370s (~6m10s) cold en VPS; warm (deploys subsecuentes) más cerca de 150-200s.

**El objetivo < 300s** se cumple con margen en dev; VPS depende de disco/CPU pero está bajo el umbral duro (720s) con enorme cabeza. Ratchet CI cazará cualquier regresión futura.

## Ratchet CI probado

`bash scripts/deploy-prod-ratchet.test.sh` → `OK: ratchet SPEC-294 pasa 5 casos` (100→OK, 480→OK frontera, 481→WARN, 720→WARN frontera, 721→FAIL exit 1).

## Notas de operación

- BuildKit REQUIERE `buildx` disponible (default en Docker 24+; el VPS lo tiene). En dev con Colima+Docker CLI 29, se instaló `docker-buildx` via Homebrew + config `~/.docker/config.json` con `cliPluginsExtraDirs`. Documentado como paso opcional en dev.
- `docker-compose` (legacy binary v5.3.1) no respeta `DOCKER_BUILDKIT=1` — hay que usar `docker compose` (subcomando integrado) O `docker buildx build` directo. `deploy-prod.sh` usa `docker compose` (correcto).
- Sin regresión funcional detectada: `src/lib/`, cliente Prisma, `node server.js` verificados en imagen final.
