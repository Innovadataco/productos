#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/4] Matando app en :5005 y workers anteriores"
lsof -ti:5005 | xargs kill -9 2>/dev/null || true
pkill -f worker-reportes.mjs 2>/dev/null || true
pkill -f worker-supervisor.mjs 2>/dev/null || true
# SPEC-171: vigilante de infraestructura (instancia única vía advisory lock)
pkill -f monitor-probes.mjs 2>/dev/null || true
# SPEC-184: simulador de abusos (instancia única vía advisory lock)
pkill -f simulador-abuso.mjs 2>/dev/null || true
# SPEC-201: worker del motor de notificaciones (instancia única vía advisory lock)
pkill -f worker-notificaciones.mjs 2>/dev/null || true
sleep 1

echo "==> [2/4] Rebuild limpio (rm -rf .next && build)"
# Sello de versión (spec 102): SHA corto del build, solo servidor. Si git falla,
# queda vacío y el panel admin muestra solo la versión (no rompe el build).
export APP_BUILD_SHA=$(git rev-parse --short HEAD 2>/dev/null || true)
rm -rf .next
npm run build

echo "==> [3/4] Levantando app (:5005, -H 0.0.0.0) + UN worker + UN monitor + UN simulador-abuso + UN worker-notificaciones"
nohup npx next start -p 5005 -H 0.0.0.0 > /tmp/app-002.log 2>&1 &
nohup npm run worker > /tmp/worker-002.log 2>&1 &
# SPEC-171: vigilante de infra (probes + incidentes). El advisory lock (exit 2
# si hay otro activo) cubre duplicados; mismas vars de entorno que el worker.
nohup node --env-file-if-exists=.env --import tsx scripts/monitor-probes.mjs > /tmp/monitor-002.log 2>&1 &
# SPEC-184: simulador de abusos. Advisory lock propio; si hay otro activo sale con código 2.
nohup node --env-file-if-exists=.env --import tsx scripts/simulador-abuso.mjs > /tmp/simulador-abuso-002.log 2>&1 &
# SPEC-201: worker del motor de notificaciones. Advisory lock propio.
nohup node --env-file-if-exists=.env --import tsx scripts/worker-notificaciones.mjs > /tmp/worker-notificaciones-002.log 2>&1 &
sleep 4

echo "==> [4/4] Healthcheck"
curl -s localhost:5005/api/health/worker && echo "  <- worker OK" || echo "  <- sin respuesta"
echo "Procesos:"; ps aux | grep -E "next start|worker-reportes|monitor-probes|simulador-abuso|worker-notificaciones" | grep -v grep || true
echo "Logs: tail -f /tmp/app-002.log | tail -f /tmp/worker-002.log | tail -f /tmp/monitor-002.log | tail -f /tmp/simulador-abuso-002.log | tail -f /tmp/worker-notificaciones-002.log"
