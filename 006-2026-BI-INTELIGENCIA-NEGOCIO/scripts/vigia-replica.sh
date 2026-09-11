#!/usr/bin/env bash
# ==========================================================================
# vigia-replica.sh · Producto 006 · Vigía de la réplica lógica bi006_replica_sub
# 2026-09-11 · I-390: la réplica estuvo caída 3 días sin avisar a nadie
# (apply worker en bucle por valor de enum desconocido; subenabled estuvo en
# 't' todo el tiempo, así que vigilar la suscripción NO alcanza).
#
# Corre por cron del VPS cada 5 min (al lado de refresh-mv.sh) y mira lo que
# solo se ve desde bi-db + el slot del publicador (SOLO LECTURA):
#   (a) apply worker muerto (pid nulo) o reiniciando en bucle (pid churn)
#   (b) mensajes sin aplicar hace > N min (PI escribe continuamente:
#       worker_logs/AuditLog tienen actividad constante)
#   (c) tablas de la suscripción fuera de r/s
#   (d) slot inactivo / WAL retenido alto o creciendo entre corridas (lado PI)
#
# Alarma: INSERT en bi_audit_log (accion VIGIA_REPLICA — visible en el panel
# /admin/bitacora, filtro «vigía réplica») + línea en el log del cron.
# Re-avisa la MISMA alerta cada 60 min mientras persista y avisa UNA vez la
# recuperación. BI no tiene canal push (sin email/webhook, Telegram eliminado
# por decisión 2026-09): la bitácora admin es el tablero de la vigía.
#
# PROBADA rompiendo una réplica desechable (dos pg16 con pub/sub: enum
# asesinado a propósito y subscriber detenido) — ver PR de SPEC-006.
# Todo es sobre-escribible por variables VIGIA_* para pruebas.
# Jamás escribe en PI: las consultas al publicador son SELECT puros.
# ==========================================================================
set -uo pipefail

ENV_FILE="${BI_ENV_FILE:-/opt/proteccion-infantil/bi-repo/006-2026-BI-INTELIGENCIA-NEGOCIO/.env.bi.production}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# ── Config (env sobre-escribible · valores por defecto = producción) ────────
BI_CONTAINER="${VIGIA_BI_CONTAINER:-bi-db}"
BI_USER="${VIGIA_BI_USER:-${REPLICA_DB_USER:?REPLICA_DB_USER falta en el env file}}"
BI_DBNAME="${VIGIA_BI_DB:-${REPLICA_DB_NAME:?REPLICA_DB_NAME falta en el env file}}"
SUB_NAME="${VIGIA_SUB:-bi006_replica_sub}"
PI_CONTAINER="${VIGIA_PI_CONTAINER:-pi-db}"
PI_USER="${VIGIA_PI_USER:-proteccion}"
PI_DBNAME="${VIGIA_PI_DB:-proteccion_infantil}"
SLOT="${VIGIA_SLOT:-bi006_replica_slot}"
ESTADO_DIR="${VIGIA_ESTADO_DIR:-/var/lib/bi-vigia}"
LOG_FILE="${VIGIA_LOG:-/var/log/bi-vigia.log}"

MAX_MIN_SIN_MENSAJES="${VIGIA_MAX_MIN_SIN_MENSAJES:-15}" # PI escribe todo el tiempo
MAX_REINICIOS="${VIGIA_MAX_REINICIOS:-3}"               # pid changes en la ventana
VENTANA_MIN="${VIGIA_VENTANA_MIN:-15}"
MAX_WAL_MB="${VIGIA_MAX_WAL_MB:-512}"
MAX_WAL_SUBIDA_MB="${VIGIA_MAX_WAL_SUBIDA_MB:-256}"     # crecimiento entre corridas
REAVISO_MIN="${VIGIA_REAVISO_MIN:-60}"
LOG_MAX_BYTES=10485760
AHORA=$(date +%s)

mkdir -p "$ESTADO_DIR"

# ── Helpers ─────────────────────────────────────────────────────────────────
sql_bi() { docker exec "$BI_CONTAINER" psql -U "$BI_USER" -d "$BI_DBNAME" -tAX -c "$1" 2>/dev/null; }
sql_pi() { docker exec "$PI_CONTAINER" psql -U "$PI_USER" -d "$PI_DBNAME" -tAX -c "$1" 2>/dev/null; }

sql_escape() { printf "%s" "$1" | sed "s/'/''/g"; }

# registro_bitacora <clave> <mensaje>: INSERT en bi_audit_log (best effort).
registro_bitacora() {
    local detalle
    detalle=$(printf '{"alerta":"%s","detalle":"%s"}' "$(sql_escape "$1")" "$(sql_escape "$2")")
    docker exec "$BI_CONTAINER" psql -U "$BI_USER" -d "$BI_DBNAME" -c \
        "INSERT INTO bi_audit_log (id, accion, email, detalle, \"creadoEn\") VALUES (gen_random_uuid()::text, 'VIGIA_REPLICA', 'vigia-replica@bi.local', '$detalle', now());" \
        > /dev/null 2>&1 || true
}

# avisar <clave> <mensaje>: dedup por episodio; re-aviso cada REAVISO_MIN.
avisar() {
    local clave="$1" mensaje="$2"
    local marca="$ESTADO_DIR/alerta-$clave"
    local ultimo=0
    [ -f "$marca" ] && ultimo=$(cat "$marca")
    if [ $((AHORA - ultimo)) -ge $((REAVISO_MIN * 60)) ]; then
        echo "$AHORA" > "$marca"
        registro_bitacora "$clave" "$mensaje"
        echo "[$(date -Is)] ALERTA $clave: $mensaje"
    fi
}

# bien <clave> <mensaje-recuperacion>: si había alerta activa, avisa y limpia.
bien() {
    local clave="$1" mensaje="$2"
    local marca="$ESTADO_DIR/alerta-$clave"
    if [ -f "$marca" ]; then
        rm -f "$marca"
        registro_bitacora "${clave}_RECUPERADA" "$mensaje"
        echo "[$(date -Is)] RECUPERADA $clave: $mensaje"
    fi
}

# ── 1. Suscripción y apply worker (bi-db) ───────────────────────────────────
LAGMIN="-"; PID="-"; ATRASADAS="?"
SUB=$(sql_bi "SELECT subenabled::int, COALESCE(pid::text,'-'),
                     COALESCE(round(EXTRACT(EPOCH FROM (now() - last_msg_receipt_time))/60)::int::text,'-')
                FROM pg_stat_subscription WHERE subname = '$SUB_NAME'" | head -1)

if [ -z "$SUB" ]; then
    avisar SUB_FALTANTE "pg_stat_subscription no devuelve fila para $SUB_NAME — la suscripción no existe o bi-db no responde"
else
    read -r ENABLED PID LAGMIN <<< "$SUB"
    if [ "$ENABLED" = "0" ]; then
        avisar SUB_DESHABILITADA "suscripción $SUB_NAME deshabilitada (subenabled=f)"
    else
        bien SUB_DESHABILITADA "suscripción $SUB_NAME habilitada de nuevo"
    fi

    if [ "$PID" = "-" ]; then
        avisar WORKER_MUERTO "apply worker sin proceso (pid nulo) — la réplica no está aplicando cambios"
    else
        bien WORKER_MUERTO "apply worker vivo de nuevo (pid $PID)"
        # Bucle: ventana deslizante de cambios de pid.
        CHURN_FILE="$ESTADO_DIR/pid-churn"
        WSTART=0; CPID="-"; CHANGES=0
        [ -f "$CHURN_FILE" ] && read -r WSTART CPID CHANGES < "$CHURN_FILE"
        if [ $((AHORA - WSTART)) -gt $((VENTANA_MIN * 60)) ]; then
            WSTART=$AHORA; CHANGES=0
        fi
        if [ "$CPID" != "-" ] && [ "$PID" != "$CPID" ]; then
            CHANGES=$((CHANGES + 1))
        fi
        echo "$WSTART $PID $CHANGES" > "$CHURN_FILE"
        if [ "$CHANGES" -ge "$MAX_REINICIOS" ]; then
            avisar WORKER_EN_BUCLE "apply worker reiniciando en bucle: $CHANGES cambios de pid en ≤ $VENTANA_MIN min (patrón I-390)"
        else
            bien WORKER_EN_BUCLE "apply worker estable (pid $PID sin churn)"
        fi
    fi

    if [ "$LAGMIN" = "-" ] || [ "$LAGMIN" -ge "$MAX_MIN_SIN_MENSAJES" ]; then
        avisar SIN_MENSAJES "sin mensajes aplicados hace ${LAGMIN}+ min (umbral $MAX_MIN_SIN_MENSAJES) — PI escribe continuamente; este silencio es la réplica caída"
    else
        bien SIN_MENSAJES "mensajes fluyendo de nuevo (lag ${LAGMIN} min)"
    fi
fi

# ── 2. Tablas de la suscripción fuera de r/s (bi-db) ────────────────────────
ATRASADAS=$(sql_bi "SELECT count(*) FROM pg_subscription_rel sr
                      JOIN pg_subscription s ON s.oid = sr.srsubid
                     WHERE s.subname = '$SUB_NAME' AND sr.srsubstate NOT IN ('r','s')" | head -1)
case "$ATRASADAS" in
    ""|*[!0-9]*) avisar SONDA_BI_FALLA "no se pudo sondear pg_subscription_rel en bi-db" ;;
    0)  bien TABLAS_ATRASADAS "todas las tablas de la suscripción en r/s" ;;
    *)  avisar TABLAS_ATRASADAS "$ATRASADAS tabla(s) de la suscripción fuera de r/s (estado i) — sincronización inicial atascada" ;;
esac

# ── 3. Slot y WAL retenido (PI · SOLO LECTURA) ──────────────────────────────
WALMB="?"
if [ -z "$(sql_pi 'SELECT 1')" ]; then
    avisar SONDA_PI_FALLA "no se pudo sondear el publicador (contenedor $PI_CONTAINER caído o sin red)"
else
    bien SONDA_PI_FALLA "publicador sondeable de nuevo"
    SLOTROW=$(sql_pi "SELECT active::int || ' ' ||
                             round(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)/1024/1024)::int
                        FROM pg_replication_slots WHERE slot_name = '$SLOT'" | head -1)
    if [ -z "$SLOTROW" ]; then
        avisar SLOT_FALTANTE "slot $SLOT no existe en el publicador — si la réplica no fue retirada, esto tumba la tolerancia a caídas"
    else
        read -r SACTIVE WALMB <<< "$SLOTROW"
        if [ "$SACTIVE" = "0" ]; then
            avisar SLOT_INACTIVO "slot $SLOT inactivo — el apply worker está caído o la suscripción deshabilitada (WAL retenido: ${WALMB} MB)"
        else
            bien SLOT_INACTIVO "slot $SLOT activo de nuevo"
        fi
        if [ "$WALMB" -ge "$MAX_WAL_MB" ]; then
            avisar WAL_ALTO "WAL retenido por $SLOT: ${WALMB} MB (umbral $MAX_WAL_MB) — la réplica no drena"
        else
            bien WAL_ALTO "WAL retenido bajo de nuevo (${WALMB} MB)"
        fi
        WALFILE="$ESTADO_DIR/ultimo-wal-mb"
        if [ ! -f "$WALFILE" ]; then
            echo "$WALMB" > "$WALFILE"   # primera corrida: sin línea base no hay crecimiento que medir
        else
            PWAL=$(cat "$WALFILE")
            echo "$WALMB" > "$WALFILE"
            if [ $((WALMB - PWAL)) -ge "$MAX_WAL_SUBIDA_MB" ]; then
                avisar WAL_CRECIENDO "WAL retenido creció $((WALMB - PWAL)) MB entre corridas (${PWAL} → ${WALMB}) — la réplica no drena"
            else
                bien WAL_CRECIENDO "WAL retenido estable (${WALMB} MB)"
            fi
        fi
    fi
fi

# ── Resumen + rotación del log (copy-truncate: el fd del cron sigue válido) ─
ACTIVAS=$(ls "$ESTADO_DIR"/alerta-* 2>/dev/null | sed 's/.*alerta-//' | paste -sd, -)
if [ -n "$ACTIVAS" ]; then
    echo "[$(date -Is)] vigía OK-parcial: alertas activas [$ACTIVAS] · lag=${LAGMIN}min pid=$PID atrasadas=${ATRASADAS} wal=${WALMB}MB"
else
    echo "[$(date -Is)] vigía OK: lag=${LAGMIN}min pid=$PID atrasadas=${ATRASADAS} wal=${WALMB}MB"
fi
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt "$LOG_MAX_BYTES" ]; then
    tail -c 5242880 "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && cat "$LOG_FILE.tmp" > "$LOG_FILE" && rm -f "$LOG_FILE.tmp"
fi
