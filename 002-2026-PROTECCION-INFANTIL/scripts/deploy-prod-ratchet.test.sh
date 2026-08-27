#!/usr/bin/env bash
# SPEC-294 (002-PI-195) — Humo del ratchet CI en deploy-prod.sh.
# Verifica que warn > 480s y fail > 720s se comporten como esperado.
#
# Uso:
#   ./scripts/deploy-prod-ratchet.test.sh
#
# El test replica in-line la lógica del ratchet (misma fuente: si cambia el
# umbral en deploy-prod.sh, actualizar aquí también — o al revés).
set -euo pipefail

run_ratchet() {
    local seconds=$1
    if [ "$seconds" -gt 720 ]; then echo "FAIL:$seconds"; return 1; fi
    if [ "$seconds" -gt 480 ]; then echo "WARN:$seconds"; return 0; fi
    echo "OK:$seconds"; return 0
}

# 5 casos: bajo umbral, en frontera blanda, sobre blanda, en frontera dura, sobre dura.
test "$(run_ratchet 100)"  = "OK:100"    || { echo "caso 100 falló"; exit 1; }
test "$(run_ratchet 480)"  = "OK:480"    || { echo "caso 480 (frontera blanda) falló"; exit 1; }
test "$(run_ratchet 481)"  = "WARN:481"  || { echo "caso 481 falló"; exit 1; }
test "$(run_ratchet 720)"  = "WARN:720"  || { echo "caso 720 (frontera dura) falló"; exit 1; }
if run_ratchet 721 >/dev/null 2>&1; then
    echo "caso 721: debió salir con exit 1"
    exit 1
fi

# Integración: correr deploy-prod.sh con PI_BUILD_SECONDS_OVERRIDE=800 debe fallar
# antes de tocar el docker. Como el script hace `git pull` primero, lo saltamos
# con --skip-pull y esperamos exit 1 en el bloque del ratchet.
# NOTE: este bloque de integración requiere un env de dev con docker; se puede
# ejecutar manualmente. En CI se omite (guarded por PI_RATCHET_TEST_INTEGRATION).
if [ "${PI_RATCHET_TEST_INTEGRATION:-0}" = "1" ]; then
    if PI_BUILD_SECONDS_OVERRIDE=800 ./scripts/deploy-prod.sh --skip-pull >/dev/null 2>&1; then
        echo "integración: PI_BUILD_SECONDS_OVERRIDE=800 debió salir con exit 1"
        exit 1
    fi
    echo "OK: integración con OVERRIDE=800 falla como esperado"
fi

echo "OK: ratchet SPEC-294 pasa 5 casos"
