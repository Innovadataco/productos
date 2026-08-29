#!/usr/bin/env bash
# SPEC-014 · apaga compose test y limpia volumen.
set -euo pipefail
cd "$(dirname "$0")/../.."
docker compose -f docker-compose.test.yml down -v
rm -f .env.integration
echo "OK entorno test limpio"
