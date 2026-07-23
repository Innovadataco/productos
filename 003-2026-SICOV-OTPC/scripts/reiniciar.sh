#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Reinicio LIMPIO del 003-SICOV-OTPC (I-16, Regla de Oro 3 · cierre 003-SICOV-007).
#
# Motivo: tras una migración de esquema, un `next dev` que sigue vivo mantiene el
# Prisma client VIEJO cacheado en memoria (Node no recarga node_modules/.prisma en
# caliente) → 500 en runtime que los tests NO atrapan. Este script mata el server,
# reconstruye y REGENERA el cliente antes de levantar.
#
# Seguridad (AGENTS §6): mata SOLO el PID que escucha el puerto 5010 y cuyo `cwd`
# es ESTA raíz del 003 — nunca por patrón de nombre, nunca procesos de 001/002.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PUERTO=5010
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

echo "▶ 003 reinicio limpio — raíz: $RAIZ"

# a. Matar SOLO el/los PID del puerto 5010 cuyo cwd coincida con esta raíz.
matados=0
for pid in $(lsof -ti tcp:"$PUERTO" -sTCP:LISTEN 2>/dev/null || true); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  if [ "$cwd" = "$RAIZ" ]; then
    echo "  ⛔ matando PID $pid (cwd=$cwd)"
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
    matados=$((matados + 1))
  else
    echo "  ✋ respeto PID $pid (cwd=$cwd ≠ raíz 003)"
  fi
done
[ "$matados" -eq 0 ] && echo "  (no había server 003 en :$PUERTO)"

# b. Borrar el build viejo.
echo "▶ rm -rf .next"
rm -rf .next

# c. Regenerar el cliente Prisma (IMPRESCINDIBLE tras cambio de esquema).
echo "▶ prisma generate"
npx prisma generate >/dev/null

# d. Aplicar migraciones pendientes.
echo "▶ prisma migrate deploy"
npx prisma migrate deploy | tail -1

# e. Levantar la app (un solo proceso) y healthcheck contra /login (espera 200).
echo "▶ next dev -p $PUERTO"
nohup npm run dev >/tmp/003-dev.log 2>&1 &
APP_PID=$!
disown "$APP_PID" 2>/dev/null || true

echo -n "▶ healthcheck /login "
code=""
for _ in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PUERTO/login" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    echo "OK (200) — server PID $APP_PID · log /tmp/003-dev.log"
    exit 0
  fi
  sleep 1
  echo -n "."
done
echo "FALLÓ (última respuesta: ${code:-sin respuesta}) — ver /tmp/003-dev.log"
exit 1
