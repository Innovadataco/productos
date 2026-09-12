#!/usr/bin/env bash
# ==========================================================================
# drift-scan-replica.sh · Producto 006 · Drift de columnas publicadas vs suscriptor
# 2026-09-12 · Nació del hallazgo post-REFRESH: horaAproximada no existía en
# bi-db (el shell viene del volcado del 01-09 y PI agregó la columna después).
# El hueco NO aparece el día que PI crea la columna: aparece el día que entra
# al canon — el primer INSERT con esa columna tumba el apply worker en bucle
# (I-390 otra vez).
#
# REGLA ADOPTADA (CEO 12-09-2026): corre ANTES del primer INSERT, no después
# del REFRESH. Obligatorio tras TODO cambio de canon que sume columnas a
# tablas ya replicadas. Un conjunto vacío de hallazgos solo significa algo
# porque el barrido lee las columnas del MASTER y las contrasta una por una.
#
# Lee las columnas publicadas del master de PI (SOLO LECTURA) y verifica que
# cada una exista en bi-db. Exit 0 = 0 ausentes · Exit 1 = drift detectado.
# Todo sobre-escribible por env para pruebas (DRIFT_*).
# ==========================================================================
set -uo pipefail

ENV_FILE="${BI_ENV_FILE:-/opt/proteccion-infantil/bi-repo/006-2026-BI-INTELIGENCIA-NEGOCIO/.env.bi.production}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

PI_CONTAINER="${DRIFT_PI_CONTAINER:-pi-db}"
PI_USER="${DRIFT_PI_USER:-proteccion}"
PI_DB="${DRIFT_PI_DB:-proteccion_infantil}"
PUB="${DRIFT_PUB:-bi_replica}"
BI_CONTAINER="${DRIFT_BI_CONTAINER:-bi-db}"
BI_USER="${DRIFT_BI_USER:-${REPLICA_DB_USER:?REPLICA_DB_USER falta (env file del 006)}}"
BI_DB="${DRIFT_BI_DB:-${REPLICA_DB_NAME:?REPLICA_DB_NAME falta (env file del 006)}}"

# Columnas publicadas, leídas del MASTER (la fuente de verdad). Formato tabla.columna.
PUBCOLS=$(docker exec "$PI_CONTAINER" psql -U "$PI_USER" -d "$PI_DB" -tAX -c "
    SELECT c.relname || '.' || a.attname
      FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
           AND a.attnum > 0 AND NOT a.attisdropped AND a.attnum = ANY(pr.prattrs)
     WHERE p.pubname = '$PUB' AND n.nspname = 'public'
     ORDER BY 1;" 2>/dev/null)

if [ -z "$PUBCOLS" ]; then
    echo "[drift-scan] ERROR: no se pudieron leer columnas publicadas de $PI_CONTAINER (¿caído o sin publicación $PUB?)"
    exit 2
fi

TOTAL=$(printf "%s\n" "$PUBCOLS" | wc -l | tr -d " ")
FALTAN=0
while IFS= read -r col; do
    T=${col%%.*}; C=${col#*.}
    EX=$(docker exec "$BI_CONTAINER" psql -U "$BI_USER" -d "$BI_DB" -tAX -c \
        "SELECT count(*) FROM information_schema.columns WHERE table_name = '$T' AND column_name = '$C';" 2>/dev/null)
    if [ "$EX" != "1" ]; then
        echo "[drift-scan] FALTA EN bi-db: $col"
        FALTAN=$((FALTAN + 1))
    fi
done <<< "$PUBCOLS"

if [ "$FALTAN" -gt 0 ]; then
    echo "[drift-scan] DRIFT: $FALTAN de $TOTAL columnas publicadas no existen en bi-db."
    echo "[drift-scan] Fix típico: ALTER TABLE ... ADD COLUMN IF NOT EXISTS (espejar tipo/default/nullable del master) ANTES del próximo INSERT."
    exit 1
fi
echo "[drift-scan] OK: $TOTAL columnas publicadas presentes en bi-db (0 ausentes)."
