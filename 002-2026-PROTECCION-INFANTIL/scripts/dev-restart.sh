#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/4] Matando app en :5005 y workers anteriores"
lsof -ti:5005 | xargs kill -9 2>/dev/null || true
pkill -f worker-reportes.mjs 2>/dev/null || true
pkill -f worker-supervisor.mjs 2>/dev/null || true
sleep 1

echo "==> [2/4] Rebuild limpio (rm -rf .next && build)"
rm -rf .next
npm run build

echo "==> [3/4] Levantando app (:5005, -H 0.0.0.0) + UN worker"
nohup npx next start -p 5005 -H 0.0.0.0 > /tmp/app-002.log 2>&1 &
nohup npm run worker > /tmp/worker-002.log 2>&1 &
sleep 4

echo "==> [4/4] Healthcheck"
curl -s localhost:5005/api/health/worker && echo "  <- worker OK" || echo "  <- sin respuesta"
echo "Procesos:"; ps aux | grep -E "next start|worker-reportes" | grep -v grep || true
echo "Logs: tail -f /tmp/app-002.log | tail -f /tmp/worker-002.log"
