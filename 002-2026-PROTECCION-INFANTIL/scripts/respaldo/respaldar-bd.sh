#!/usr/bin/env bash
# SPEC-978 (infra) — Respaldo diario CIFRADO de las bases de IDC. Lo corre root por cron en el VPS.
#
# El VPS no tiene respaldos desde el 21-08. Este script vuelca pi-db y bi-db y los deja CIFRADOS con
# `age` en /var/backups/idc/<pi|bi>/, de donde el Mac los baja. Reemplaza al respaldo INTERINO
# (/usr/local/sbin/idc-respaldo-bd.sh): MISMO destino, MISMOS nombres <proyecto>-AAAAMMDD-HHMM.dump.age
# + .sha256, 640 root:respaldo, retención 14 días y flock /var/lock/respaldo-bd.lock, para que el Mac
# siga bajando sin cambios.
#
# PROPIEDAD DURA (la verifica el candado): el dump JAMÁS toca el disco en claro. `pg_dump` se cifra EN
# EL MISMO PIPE (`| age -r <pública> > tmp`); solo el .age (ya cifrado) se escribe, y por `mv` atómico.
# La CLAVE PÚBLICA no es secreta, pero es configuración: llega por variable (RESPALDO_AGE_PUBKEY, del
# .env.production del VPS) con fallback al fichero /etc/idc-respaldos/age.pub. SIN destinatario → ABORTA
# sin escribir nada (fail-closed): nunca ciframos a una clave vacía ni dejamos un dump en claro.
#
# GARANTÍAS:
#  · set -o pipefail → un pg_dump que falla tumba el pipe (no se da por bueno un .age truncado).
#  · archivo final > 0 bytes o se descarta.
#  · .sha256 al lado de cada dump (verificable con `sha256sum -c` dentro de la carpeta).
#  · permisos 640 root:respaldo (chmod siempre; chown best-effort: avisa si no es root).
#  · retención: SOLO tras un respaldo OK de esa base borra de SU carpeta los *.dump.age/.sha256 con
#    más de RESPALDO_RETENCION_DIAS (default 14). Si el respaldo de hoy falló, NO purga (no erosiona
#    el histórico por una corrida rota).
#  · si una base falla, la otra SÍ se intenta; exit != 0 si cualquiera falló.
#  · flock: una sola corrida a la vez.
#  · --dry-run: no escribe nada (enseña el plan). Flag no reconocido → ABORTA (exit 2) sin tocar nada.
#
# Uso:  scripts/respaldo/respaldar-bd.sh [--dry-run]
#
# Config por entorno (defaults = PRODUCCIÓN; los overrides permiten probar en local contra la BD de dev):
#   RESPALDO_AGE_PUBKEY        destinatario age (age1…); si falta, se lee de RESPALDO_AGE_PUBKEY_FILE.
#   RESPALDO_AGE_PUBKEY_FILE   fichero con la pública        (default /etc/idc-respaldos/age.pub)
#   RESPALDO_DIR               raíz de destino               (default /var/backups/idc)
#   RESPALDO_LOG               log                           (default /var/log/idc-respaldo.log)
#   RESPALDO_LOCK              lockfile de flock             (default /var/lock/respaldo-bd.lock)
#   RESPALDO_RETENCION_DIAS    días a conservar              (default 14)
#   RESPALDO_GRUPO             grupo del chown root:<grupo>  (default respaldo)
#   PI_DB_CONTAINER/USER/NAME  contenedor/usuario/base pi    (default pi-db / proteccion / proteccion_infantil)
#   BI_DB_CONTAINER            contenedor bi                 (default bi-db; usuario y base se leen de su env)
set -uo pipefail

# ---- configuración (defaults = producción) ------------------------------------------------------
RESPALDO_DIR="${RESPALDO_DIR:-/var/backups/idc}"
RESPALDO_LOG="${RESPALDO_LOG:-/var/log/idc-respaldo.log}"
RESPALDO_LOCK="${RESPALDO_LOCK:-/var/lock/respaldo-bd.lock}"
RESPALDO_RETENCION_DIAS="${RESPALDO_RETENCION_DIAS:-14}"
RESPALDO_GRUPO="${RESPALDO_GRUPO:-respaldo}"
RESPALDO_AGE_PUBKEY_FILE="${RESPALDO_AGE_PUBKEY_FILE:-/etc/idc-respaldos/age.pub}"

PI_DB_CONTAINER="${PI_DB_CONTAINER:-pi-db}"
PI_DB_USER="${PI_DB_USER:-proteccion}"
PI_DB_NAME="${PI_DB_NAME:-proteccion_infantil}"
BI_DB_CONTAINER="${BI_DB_CONTAINER:-bi-db}"

DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        *)
            echo "respaldar-bd: flag no reconocido: '$arg' (solo --dry-run). ABORTA sin escribir nada." >&2
            exit 2
            ;;
    esac
done

# ---- utilidades --------------------------------------------------------------------------------
log() {
    local msg="[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
    # Best-effort al fichero (puede no existir en local); SIEMPRE a stderr para el operador/cron.
    printf '%s\n' "$msg" >>"$RESPALDO_LOG" 2>/dev/null || true
    printf '%s\n' "$msg" >&2
}

sha256_de() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}'
    fi
}

# PURA Y TESTEABLE: la ruta de destino de un respaldo. Sin esto escrito en un solo sitio, el candado no
# podría anclar el patrón <dir>/<label>/<proyecto>-<stamp>.dump.age.
ruta_respaldo() {
    local dir="$1" label="$2" proyecto="$3" stamp="$4"
    printf '%s/%s/%s-%s.dump.age\n' "$dir" "$label" "$proyecto" "$stamp"
}

# PURA Y TESTEABLE (sin fecha del sistema): extrae el AAAAMMDD embebido en un nombre
# `<proyecto>-AAAAMMDD-HHMM.dump.age` (o .sha256). Vacío si no casa.
fecha_de_nombre() {
    if [[ "$1" =~ -([0-9]{8})-[0-9]{4}\. ]]; then
        printf '%s\n' "${BASH_REMATCH[1]}"
    fi
    return 0
}

# PURA Y TESTEABLE (sin `find` ni reloj): dado el corte AAAAMMDD ($1), lee de STDIN nombres (uno por
# línea) e imprime los que tienen fecha ESTRICTAMENTE anterior al corte (AAAAMMDD compara lexicográfico).
# Un nombre sin fecha válida NUNCA sale (no se borra lo que no se entiende).
seleccionar_respaldos_a_borrar() {
    local corte="$1" nombre fecha
    while IFS= read -r nombre; do
        [ -z "$nombre" ] && continue
        fecha="$(fecha_de_nombre "$nombre")"
        [ -z "$fecha" ] && continue
        if [[ "$fecha" < "$corte" ]]; then
            printf '%s\n' "$nombre"
        fi
    done
}

# ---- destinatario age (fail-closed) ------------------------------------------------------------
resolver_pubkey() {
    local k="${RESPALDO_AGE_PUBKEY:-}"
    if [ -z "$k" ] && [ -r "$RESPALDO_AGE_PUBKEY_FILE" ]; then
        # primera línea no vacía y que no sea comentario
        k="$(grep -m1 -E '^age1[0-9a-z]+' "$RESPALDO_AGE_PUBKEY_FILE" 2>/dev/null || true)"
    fi
    k="${k%%[[:space:]]*}"
    printf '%s' "$k"
}

# ---- respaldo de UNA base ----------------------------------------------------------------------
# $1 label(pi|bi)  $2 contenedor  $3 usuario  $4 base  $5 proyecto(prefijo de fichero)
respaldar_una_base() {
    local label="$1" contenedor="$2" usuario="$3" base="$4" proyecto="$5"
    local stamp dest destdir tmp shatmp hash
    stamp="$(date -u +%Y%m%d-%H%M)"
    destdir="$RESPALDO_DIR/$label"
    dest="$(ruta_respaldo "$RESPALDO_DIR" "$label" "$proyecto" "$stamp")"

    if [ "$DRY_RUN" = "1" ]; then
        log "(dry-run) $label: docker exec $contenedor pg_dump -U $usuario -Fc $base | age -r <pública> > $dest (+ .sha256)"
        return 0
    fi

    if ! mkdir -p "$destdir" 2>/dev/null; then
        log "🚨 $label: no se pudo crear $destdir"
        return 1
    fi
    tmp="$dest.tmp.$$"

    # EL PIPE CIFRADO: pg_dump → age → fichero. Nada en claro toca el disco. pipefail hace que un
    # pg_dump fallido tumbe el pipe aunque age escriba algo.
    if ! docker exec "$contenedor" pg_dump -U "$usuario" -Fc "$base" | age -r "$PUBKEY" >"$tmp"; then
        log "🚨 $label: falló el volcado/cifrado de $base (pg_dump|age) — se descarta el temporal"
        rm -f "$tmp"
        return 1
    fi
    if [ ! -s "$tmp" ]; then
        log "🚨 $label: el respaldo de $base quedó VACÍO (0 bytes) — se descarta"
        rm -f "$tmp"
        return 1
    fi

    chmod 640 "$tmp" 2>/dev/null || true
    chown "root:$RESPALDO_GRUPO" "$tmp" 2>/dev/null || log "⚠️  $label: no se pudo chown root:$RESPALDO_GRUPO (¿no root?) — se sigue con chmod 640"

    hash="$(sha256_de "$tmp")"
    shatmp="$dest.sha256.tmp.$$"
    printf '%s  %s\n' "$hash" "$(basename "$dest")" >"$shatmp"
    chmod 640 "$shatmp" 2>/dev/null || true
    chown "root:$RESPALDO_GRUPO" "$shatmp" 2>/dev/null || true

    # mv atómicos (mismo filesystem): el .age y su .sha256 aparecen ya completos.
    mv -f "$tmp" "$dest"
    mv -f "$shatmp" "$dest.sha256"
    log "✅ $label: $(basename "$dest") ($(wc -c <"$dest" | tr -d ' ') bytes, sha256 $hash)"
    return 0
}

# ---- retención (solo tras OK de esa base) ------------------------------------------------------
aplicar_retencion() {
    # OJO: `local` expande TODOS sus argumentos antes de asignar, así que no se puede referir a `label`
    # en la misma sentencia (bajo `set -u` sería «unbound variable»). Van en dos `local`.
    local label="$1"
    local dir="$RESPALDO_DIR/$label" corte nombre
    corte="$(date -u -d "${RESPALDO_RETENCION_DIAS} days ago" +%Y%m%d 2>/dev/null || true)"
    if [ -z "$corte" ]; then
        log "⚠️  $label: no se pudo calcular el corte de retención (date -d) — se omite purga"
        return 0
    fi
    [ -d "$dir" ] || return 0
    # Solo *.dump.age y *.sha256 de ESTA carpeta (maxdepth 1); nunca otros ficheros ni subcarpetas.
    local a_borrar
    a_borrar="$(find "$dir" -maxdepth 1 -type f \( -name '*.dump.age' -o -name '*.sha256' \) -printf '%f\n' 2>/dev/null \
        | seleccionar_respaldos_a_borrar "$corte")"
    [ -z "$a_borrar" ] && return 0
    while IFS= read -r nombre; do
        [ -z "$nombre" ] && continue
        if [ "$DRY_RUN" = "1" ]; then
            log "(dry-run) $label: retención borraría $nombre (fecha < $corte)"
        else
            rm -f -- "$dir/$nombre" && log "🧹 $label: retención borró $nombre"
        fi
    done <<<"$a_borrar"
}

# ---- main --------------------------------------------------------------------------------------
main() {
    PUBKEY="$(resolver_pubkey)"
    if ! [[ "$PUBKEY" =~ ^age1[0-9a-z]+$ ]]; then
        log "🚨 sin destinatario age válido (RESPALDO_AGE_PUBKEY ni $RESPALDO_AGE_PUBKEY_FILE). ABORTA sin escribir."
        return 1
    fi
    log "respaldo iniciado (dry-run=$DRY_RUN, destinatario ${PUBKEY:0:12}…, retención ${RESPALDO_RETENCION_DIAS}d)"

    local fallos=0

    # --- pi-db: usuario y base FIJOS (proteccion / proteccion_infantil) ---
    if respaldar_una_base "pi" "$PI_DB_CONTAINER" "$PI_DB_USER" "$PI_DB_NAME" "$PI_DB_NAME"; then
        aplicar_retencion "pi"
    else
        fallos=$((fallos + 1))
    fi

    # --- bi-db: usuario y base se leen del ENTORNO del contenedor (hoy bi_admin / bi) ---
    local bi_user bi_db
    bi_user="$(docker exec "$BI_DB_CONTAINER" printenv POSTGRES_USER 2>/dev/null || true)"
    bi_db="$(docker exec "$BI_DB_CONTAINER" printenv POSTGRES_DB 2>/dev/null || true)"
    if [ -z "$bi_user" ] || [ -z "$bi_db" ]; then
        log "🚨 bi: no se pudo leer POSTGRES_USER/POSTGRES_DB de $BI_DB_CONTAINER — se omite esta base"
        fallos=$((fallos + 1))
    elif respaldar_una_base "bi" "$BI_DB_CONTAINER" "$bi_user" "$bi_db" "$bi_db"; then
        aplicar_retencion "bi"
    else
        fallos=$((fallos + 1))
    fi

    if [ "$fallos" -gt 0 ]; then
        log "respaldo terminó con $fallos base(s) fallida(s)."
        return 1
    fi
    log "respaldo OK (todas las bases)."
    return 0
}

# Solo corre bajo flock al EJECUTAR; con `source` (candado) quedan expuestas las funciones sin ejecutar.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    if command -v flock >/dev/null 2>&1; then
        exec 9>"$RESPALDO_LOCK"
        if ! flock -n 9; then
            echo "respaldar-bd: ya hay un respaldo en curso (flock $RESPALDO_LOCK) — se omite." >&2
            exit 0
        fi
    else
        echo "⚠️  respaldar-bd: 'flock' no disponible — se corre sin lock (esperado solo fuera del VPS)." >&2
    fi
    main
    exit $?
fi
