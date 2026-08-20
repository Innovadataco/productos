#!/usr/bin/env bash
# SPEC-183 (002-PI-078): verifica que el usuario zeus_readonly sea realmente solo lectura
# y que no pueda leer tablas del sistema.
#
# Uso (en el VPS, con .env.production cargado):
#   ./scripts/verificar-zeus-readonly.sh
#
# Variables requeridas:
#   DB_ZEUS_READONLY_PASSWORD
# Variables opcionales: DB_HOST, DB_PORT, DB_NAME

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-proteccion_infantil}"
ZEUS_USER="${ZEUS_USER:-zeus_readonly}"
ZEUS_PASSWORD="${DB_ZEUS_READONLY_PASSWORD:-}"

if [ -z "$ZEUS_PASSWORD" ]; then
    echo "ERROR: DB_ZEUS_READONLY_PASSWORD no está definida" >&2
    exit 1
fi

export PGPASSWORD="$ZEUS_PASSWORD"

ERRORS=0

check() {
    local desc="$1"
    local sql="$2"
    local expect_ok="$3"

    echo -n "[TEST] ${desc}: "
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$ZEUS_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 -c "$sql" >/dev/null 2>&1; then
        if [ "$expect_ok" = "ok" ]; then
            echo "OK"
        else
            echo "FALLÓ (debería haber sido denegado)"
            ERRORS=$((ERRORS + 1))
        fi
    else
        if [ "$expect_ok" = "fail" ]; then
            echo "OK (denegado)"
        else
            echo "FALLÓ (debería haber funcionado)"
            ERRORS=$((ERRORS + 1))
        fi
    fi
}

check "SELECT en tabla de aplicación" "SELECT 1 FROM public.\"Reporte\" LIMIT 1;" "ok"
check "INSERT denegado" "INSERT INTO public.\"Reporte\" (id) VALUES ('00000000-0000-0000-0000-000000000000');" "fail"
check "UPDATE denegado" "UPDATE public.\"Reporte\" SET estado = 'PENDIENTE' WHERE false;" "fail"
check "DELETE denegado" "DELETE FROM public.\"Reporte\" WHERE false;" "fail"
check "TRUNCATE denegado" "TRUNCATE public.\"Reporte\";" "fail"
check "CREATE TABLE denegado" "CREATE TABLE public.zeus_test_table (id int);" "fail"
check "DROP TABLE denegado" "DROP TABLE IF EXISTS public.zeus_test_table;" "fail"
check "pg_shadow no legible" "SELECT * FROM pg_shadow LIMIT 1;" "fail"
check "pg_authid no legible" "SELECT * FROM pg_authid LIMIT 1;" "fail"

if [ "$ERRORS" -eq 0 ]; then
    echo "[OK] Todos los checks de aislamiento pasaron."
    exit 0
else
    echo "[ERROR] ${ERRORS} check(s) fallaron." >&2
    exit 1
fi
