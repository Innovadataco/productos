#!/usr/bin/env bash
# SPEC-903 (infra) — Retención de imágenes `pi-app` + caché de build al FINAL del deploy.
#
# El disco del VPS llegó a 94%: `deploy-prod.sh` deja una imagen pi-app:<sha> de ~1.84GB por deploy y la
# caché de build crece sin tope, sin retención. Este paso corre SOLO tras «DEPLOY VERIFICADO» (nunca antes,
# para no interferir con el deploy en curso) y:
#   1) IMÁGENES: conserva las N más nuevas de `pi-app` (DEFAULT N=1 — decisión de Jelkin: prioridad disco,
#      pre-lanzamiento, un rollback se rehace con `git checkout <sha>` + build). SIEMPRE protege, además,
#      `latest` + el SHA recién desplegado (PI_APP_TAG) + la imagen de TODO contenedor CORRIENDO — jamás se
#      borra la imagen en uso, aunque no sea de las N más nuevas.
#   2) CACHÉ: `docker builder prune -f --keep-storage=10GB` (conserva lo reciente; nunca `-af`, que dejaría
#      todos los builds lentos).
#
# SEGURIDAD (dura): un fallo de retención ADVIERTE pero NO tumba el deploy ya verificado (retención = exit 0
# pase lo que pase). Un `docker rmi` que falla (imagen en uso) se SALTA. Un flag no reconocido ABORTA
# fail-safe ANTES de tocar nada (exit 2, no borra) — un typo no debe disparar un borrado silencioso.
#
# Uso:  scripts/retener-imagenes-deploy.sh [--dry-run]       (RETENER_N=<n> para override; default 1)
set -uo pipefail  # NO -e: la retención nunca aborta el deploy

KEEP_N="${RETENER_N:-1}"
DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        *)
            echo "retener-imagenes-deploy: flag no reconocido: '$arg' (solo --dry-run). ABORTA sin borrar nada." >&2
            exit 2
            ;;
    esac
done

# PURA Y TESTEABLE (sin docker): dado el N a conservar ($1) y los IDs PROTEGIDOS separados por espacio ($2),
# leyendo de STDIN los IDs candidatos MÁS NUEVO PRIMERO (uno por línea), imprime los IDs A BORRAR — los que
# NO están entre los $1 más nuevos NI protegidos. La imagen en uso/latest/desplegada (protegida) jamás sale.
seleccionar_a_borrar() {
    local keep_n="$1"
    local protegidos=" $2 "
    local i=0 id
    while IFS= read -r id; do
        [ -z "$id" ] && continue
        i=$((i + 1))
        if [ "$i" -le "$keep_n" ]; then continue; fi       # entre los N más nuevos → conservar
        case "$protegidos" in *" $id "*) continue ;; esac   # protegido (corriendo/latest/desplegado) → conservar
        printf '%s\n' "$id"
    done
}

main() {
    local repo="pi-app"
    # `docker images` ya ordena por creación DESC (más nueva primero); full sha, sin duplicados por multi-tag.
    local candidatos
    candidatos="$(docker images "$repo" --no-trunc --format '{{.ID}}' 2>/dev/null | awk 'NF && !seen[$0]++')"

    # Set PROTEGIDO: latest + SHA recién desplegado + imagen de cada contenedor corriendo (full sha, igual
    # formato que `docker images --no-trunc`).
    local protegidos="" cid
    protegidos+=" $(docker image inspect "$repo:latest" --format '{{.Id}}' 2>/dev/null || true)"
    if [ -n "${PI_APP_TAG:-}" ]; then
        protegidos+=" $(docker image inspect "$repo:${PI_APP_TAG}" --format '{{.Id}}' 2>/dev/null || true)"
    fi
    for cid in $(docker ps -q 2>/dev/null); do
        protegidos+=" $(docker inspect "$cid" --format '{{.Image}}' 2>/dev/null || true)"
    done

    local a_borrar
    a_borrar="$(printf '%s\n' "$candidatos" | seleccionar_a_borrar "$KEEP_N" "$protegidos")"

    if [ -z "$a_borrar" ]; then
        echo "[retención] imágenes: nada que borrar (se conservan $KEEP_N más nueva(s) + en uso/latest)."
    else
        local id
        while IFS= read -r id; do
            [ -z "$id" ] && continue
            if [ "$DRY_RUN" = "1" ]; then
                echo "[retención] (dry-run) borraría imagen $id"
            elif docker rmi "$id" >/dev/null 2>&1; then
                echo "[retención] imagen borrada: $id"
            else
                echo "⚠️  [retención] no se pudo borrar $id (¿en uso?) — se salta"
            fi
        done <<< "$a_borrar"
    fi

    if [ "$DRY_RUN" = "1" ]; then
        echo "[retención] (dry-run) docker builder prune -f --keep-storage=10GB"
    elif docker builder prune -f --keep-storage=10GB >/dev/null 2>&1; then
        echo "[retención] caché de build podada (se conservan 10GB recientes)."
    else
        echo "⚠️  [retención] no se pudo podar la caché de build — se salta"
    fi

    # SPEC-903: TRIM best-effort al final. Cuando la purga libera GB DENTRO del guest, el hipervisor (panel
    # de Hostinger) los sigue viendo ocupados hasta un fstrim; el VPS tiene fstrim.timer SEMANAL, así que tras
    # un deploy que libera mucho el panel queda desfasado hasta una semana. `fstrim -a` devuelve los bloques
    # al hipervisor EN EL ACTO. Best-effort TOTAL: `sudo -n` (nunca pide clave → nunca cuelga el deploy); si
    # no hay privilegios, se salta (el fstrim.timer lo hará igual). Jamás tumba el deploy.
    if [ "$DRY_RUN" = "1" ]; then
        echo "[retención] (dry-run) fstrim -a (devolvería al hipervisor los bloques liberados)"
    elif fstrim -a 2>/dev/null || sudo -n fstrim -a 2>/dev/null; then
        echo "[retención] fstrim -a OK (el panel del hipervisor reflejará el disco liberado)."
    else
        echo "⚠️  [retención] fstrim no disponible/sin privilegios — se salta (fstrim.timer semanal lo hará)."
    fi

    return 0  # la retención NUNCA falla el deploy
}

# Solo corre main cuando se EJECUTA; al hacer `source` (candado) quedan expuestas las funciones sin ejecutar.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
