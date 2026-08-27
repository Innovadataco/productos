# SPEC-294 — Deploy lento · reducir 9m30s → <5min

**Radicado**: 002-PI-195 · frente A-37 · cierra deuda operativa  
**Tipo**: Optimización de build  
**Estado**: IMPLEMENTADO  
**Fecha**: 2026-08-27  
**Impacto en arquitectura:** solo `Dockerfile` + `scripts/deploy-prod.sh`. Cero cambios en app, workers, migraciones o proxy. Cero cambio de base image, versión de Node/Next o orquestador.

---

## Baseline medido

- **VPS (Fábrica, deploy #3 sobre `df44d923`):** **563s** (9m30s) — diagnóstico completo en brief §2.
- **Dev local (M-series, este worktree, cold cache, classic builder):** **306s** (5m6s). Es más rápido que VPS por CPU/IO. Las optimizaciones aplican proporcionalmente.

Tiempos por etapa dominantes (Fábrica en VPS):

| Etapa Dockerfile | Tiempo VPS | Diagnóstico |
|------------------|-----------:|-------------|
| deps · `RUN npm ci` (con devDeps) | ~103s | Descarga full |
| builder · `RUN npx prisma generate && npm run build` | ~113s + prisma | `next build` normal |
| prod-deps · `RUN npm ci --omit=dev && npx prisma generate` | ~103s + prisma | **DUPLICACIÓN de descarga vs `deps` (cache tarball perdido)** |
| runner · `COPY --from=builder /app/src` | ~71s | **PESO MUERTO** — solo `src/lib/` es necesario en runtime |
| runner · `COPY --from=prod-deps ... node_modules` | ~70s | Layer full |
| Otros COPY, exporting, layer flush | ~130s | Normal |

---

## Verificación previa (candado D-007)

Sobre `origin/feature/001-scaffolding@df44d923`:

- `Dockerfile` tiene 4 stages: `deps`, `builder`, `prod-deps`, `runner`.
- `next.config.ts` → `output: "standalone"` ✓ (verificado).
- `scripts/deploy-prod.sh` líneas 21-23: `$COMPOSE build` sin medición ni ratchet.
- **Workers `.mjs` importan SOLO de `../src/lib/*.ts`** (grep exhaustivo confirma cero imports de `src/app`, `src/components`, `src/hooks`). Por eso puedo reducir `COPY /src` → `COPY /src/lib` sin romper workers.
- `src/` en total = 12M · `src/lib/` = 5.4M · `src/app/` = 4.5M · `src/components/` = 2.5M · `src/hooks/` = 8K.

---

## Optimizaciones (3 + ratchet)

### 3.1 · Cache mount de `npm ci` (BuildKit) — Alto ROI · target −80–100s

- Habilitar BuildKit: `deploy-prod.sh` exporta `DOCKER_BUILDKIT=1` (además de `COMPOSE_DOCKER_CLI_BUILD=1`).
- `Dockerfile`: `RUN --mount=type=cache,target=/root/.npm npm ci` en **ambos** `deps` y `prod-deps`. Tarballs se reutilizan entre stages (mismo `package-lock.json` hash → cache warm).
- `# syntax=docker/dockerfile:1` ya está declarado (necesario para `--mount`).

**Justificación de no reutilizar `node_modules` de `deps` en `prod-deps`:**  
`deps` instala CON devDependencies (necesario para `next build` en `builder`), mientras que `prod-deps` corre `--omit=dev` porque el runner debe llevar solo prod. Reutilizar el `node_modules` de `deps` en el runner metería devDeps innecesarias → imagen más grande. La cache de tarballs es el punto correcto de compartición.

### 3.2 · Copiar solo `src/lib` al runner — Alto ROI · target −40–70s

Cambio en `Dockerfile` runner:
```
- COPY --from=builder /app/src ./src
+ # SPEC-294: los workers .mjs solo importan de ../src/lib/*.ts (grep exhaustivo).
+ # El resto de src/ (app, components, hooks) YA está empaquetado en .next/standalone.
+ COPY --from=builder /app/src/lib ./src/lib
```

Reduce payload copiado ~55% (12M → 5.4M).

**No aplico standalone puro (retirar todo `src/`)** porque los workers dependen literalmente de `../src/lib/*.ts` interpretado por `tsx`. Sin `src/lib/`, el worker rompe.

### 3.3 · Consolidar `prisma generate` a una sola etapa — Medio ROI · target −30–60s

- Quitar `npx prisma generate` de `prod-deps` (queda solo `npm ci --omit=dev`).
- En el runner, después de `COPY --from=prod-deps /app/node_modules`, añadir:
  ```
  COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
  ```
- El cliente Prisma generado en `builder` (donde ya se necesita para `next build`) se reutiliza en el runner.

### 4 · Ratchet CI en `deploy-prod.sh`

Envolver el `$COMPOSE build` con medición y umbrales:

```bash
BUILD_START=$(date +%s)
$COMPOSE build
BUILD_END=$(date +%s)
BUILD_SECONDS=$((BUILD_END - BUILD_START))
echo "==> Build tardó ${BUILD_SECONDS}s"
if [ "$BUILD_SECONDS" -gt 720 ]; then
    echo "❌ FAIL: build tardó ${BUILD_SECONDS}s (> 8 min · umbral duro SPEC-294)"
    exit 1
fi
if [ "$BUILD_SECONDS" -gt 480 ]; then
    echo "⚠️  WARN: build tardó ${BUILD_SECONDS}s (> 5 min · umbral blando SPEC-294)"
fi
```

Umbrales por brief §4: warn > 480s, fail > 720s. Se prueba con override `PI_BUILD_SECONDS_OVERRIDE=<seg>` (nuevo) que permite testear sin construir realmente.

---

## Estado objetivo

- Build dev < **300s** (5 min duro) en 2 corridas consecutivas post-cache-warm.
- Build VPS objetivo < **300s** también (proyección: reducción proporcional del 45-50%).
- Ratchet CI activo con umbrales 480/720s.
- Cero regresión: app arranca, workers arrancan, `/api/health` = 200 en < 90s.

---

## Candados

- 🛑 Cero cambios en app/workers/proxy/AI/migraciones.
- 🛑 Alpine se queda (no Debian). Node 22 se queda. Next 16.2.10 se queda.
- 🛑 Docker Compose se queda (no k8s).
- 🛑 No optimizar `next build` interno (fuera de scope).
- 🛑 No secretos en el chat ni en el diff (I-142/I-144).
- ✅ Regla D-004: cronometrar en vivo antes de REALIZADO (mínimo 2 corridas).
