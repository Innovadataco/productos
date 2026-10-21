#!/usr/bin/env bash
# SPEC-903 (infra) — Guardia de disco ANTES del build. Un deploy nunca debe llenar el disco del VPS (llegó a
# 94%). Mide el espacio LIBRE en `/` y ABORTA el deploy (exit != 0, antes del build) si está por debajo del
# umbral seguro (DEPLOY_MIN_DISCO_GB, default 15g — un build necesita varios GB + la imagen de ~1.84GB).
# Complementa la retención del final (`retener-imagenes-deploy.sh`): la guardia VALIDA antes, la retención
# LIMPIA después.
#
# Uso:  scripts/guardia-disco-deploy.sh            (DEPLOY_MIN_DISCO_GB=<n> para override; default 15)
set -uo pipefail

UMBRAL_GB="${DEPLOY_MIN_DISCO_GB:-15}"

# PURA Y TESTEABLE (sin df): dado el espacio libre en GB ($1) y el umbral en GB ($2), imprime "ABORT" si
# libres < umbral, "OK" en otro caso (libres == umbral NO aborta: el umbral es el mínimo aceptable).
decidir_guardia_disco() {
    local libres="$1" umbral="$2"
    if [ "$libres" -lt "$umbral" ]; then
        echo "ABORT"
    else
        echo "OK"
    fi
}

main() {
    # Espacio libre en `/`, en GB enteros (truncado hacia abajo → conservador: 14.9g cuenta como 14g).
    # `df -Pk` = formato POSIX (una línea) en KB; columna 4 = Available.
    local libres_kb libres_gb
    libres_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
    if ! [[ "$libres_kb" =~ ^[0-9]+$ ]]; then
        echo "⚠️  [guardia-disco] no se pudo medir el disco (df) — se continúa sin bloquear." >&2
        return 0
    fi
    libres_gb=$(( libres_kb / 1024 / 1024 ))

    if [ "$(decidir_guardia_disco "$libres_gb" "$UMBRAL_GB")" = "ABORT" ]; then
        echo "🚨 [guardia-disco] disco bajo: ${libres_gb}g libres < ${UMBRAL_GB}g — el deploy NO continúa." >&2
        echo "   Liberá espacio antes: scripts/retener-imagenes-deploy.sh  (o --dry-run para ver qué quitaría)." >&2
        exit 1
    fi
    echo "[guardia-disco] OK: ${libres_gb}g libres (≥ ${UMBRAL_GB}g)."
}

# Solo corre main al EJECUTAR; con `source` (candado) quedan expuestas las funciones sin ejecutar nada.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
