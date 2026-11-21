#!/bin/sh
# Inversiones · carga sin copias en el VPS, dentro del contenedor del migrador (/usr/local/bin/inv-cargar).
# Lo llama scripts/cargar-prod.sh con `run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar <comando>`
# y el sobre por la entrada estándar (lo arma scripts/armar-sobre.sh en el Mac):
#   - cabecera de EXACTAMENTE 4096 bytes: un argumento por línea, una línea vacía y relleno de líneas vacías. Con
#     archivo trae --bytes <N> y --sha256 <H>, que se consumen aquí y no pasan al CLI;
#   - el archivo (importar-trii, importar-plan, importar-certificacion e importar-precios).
# Antes de leer nada comprueba que el contenedor no use swap: el temporal vive en el tmpfs /tmp, que con
# mem = memswap no baja al disco. El archivo queda en un temporal 600 dentro de una carpeta 700 con nombre fijo
# (trii.csv, ficha.md, certificacion.pdf o precios.csv: el nombre real no llega a la base), corre el CLI y lo borra
# SIEMPRE (trap), también si el CLI falla o llega una señal. El tmpfs muere con el contenedor.
# Nunca imprime la cabecera ni el archivo: solo errores sin valores. Sale con 64 (EX_USAGE, distinto de los
# códigos de los CLI, de 0 a 3) si se niega sin correr el CLI, o con el código del CLI.
# Solo POSIX (busybox en la imagen; dash o bash en las pruebas). INV_CARGAR_* solo los usan las pruebas.
set -eu
ulimit -c 0
umask 077

APP_DIR="${INV_CARGAR_APP:-/app}"
TMP_BASE="${INV_CARGAR_TMP:-/tmp}"
SWAP_MAX="${INV_CARGAR_SWAP:-/sys/fs/cgroup/memory.swap.max}"
BLOQUE=4096
MAX_ARGUMENTOS=30
MAX_LARGO=512
TOPE_TRII=5242880
TOPE_FICHA=262144
# Los dos siguientes son los topes de sus CLI (una sola fuente; tests/unit/produccion/cargar-contenedor.test.ts los
# compara): MAX_BYTES del PDF (src/importacion/av/pdf/documento.ts) y MAX_BYTES_CSV (src/precios/csv-cierres.ts).
TOPE_CERTIFICACION=15728640
TOPE_PRECIOS=4194304

NIEGA=64
falla() {
  printf '❌ [carga] %s\n' "$1" >&2
  exit "$NIEGA"
}

[ $# -eq 1 ] || falla "uso: inv-cargar <comando>; los parámetros y el archivo llegan por la entrada estándar"
comando="$1"
shift
archivo=""
tope=0
case "$comando" in
  importar-trii) cli=scripts/importar-trii.ts archivo=trii.csv tope=$TOPE_TRII ;;
  importar-plan) cli=scripts/importar-plan.ts archivo=ficha.md tope=$TOPE_FICHA ;;
  importar-certificacion) cli=scripts/importar-certificacion.ts archivo=certificacion.pdf tope=$TOPE_CERTIFICACION ;;
  importar-precios) cli=scripts/importar-precios.ts archivo=precios.csv tope=$TOPE_PRECIOS ;;
  registrar-escision) cli=scripts/registrar-escision.ts ;;
  lote-escision) cli=scripts/lote-escision.ts ;;
  construir-lotes) cli=scripts/construir-lotes.ts ;;
  conciliar-certificacion) cli=scripts/conciliar-certificacion.ts ;;
  *) falla "comando no permitido" ;;
esac

[ "$(cat "$SWAP_MAX" 2>/dev/null || true)" = "0" ] ||
  falla "el contenedor podría usar swap (memory.swap.max distinto de 0 o ilegible): no se lee la entrada"

dir="$(mktemp -d "$TMP_BASE/inv-carga.XXXXXX")" || falla "no se pudo crear la carpeta temporal"
hijo=""
limpiar() { rm -rf "$dir"; }
terminar() {
  # Al hijo siempre TERM: en un sh sin control de trabajos, un proceso en segundo plano nace con INT ignorado.
  if [ -n "$hijo" ]; then
    kill -s TERM "$hijo" 2>/dev/null || true
    wait "$hijo" 2>/dev/null || true
  fi
  limpiar
  trap - EXIT
  case "$1" in INT) exit 130 ;; HUP) exit 129 ;; *) exit 143 ;; esac
}
trap limpiar EXIT
trap 'terminar INT' INT
trap 'terminar TERM' TERM
trap 'terminar HUP' HUP

tamano() { wc -c <"$1" | tr -d ' '; }
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then set -- "$(sha256sum "$1")"; else set -- "$(shasum -a 256 "$1")"; fi
  printf '%s' "${1%% *}"
}

# Cabecera: exactamente BLOQUE bytes, leídos de a uno (nunca más: lo que sigue es el archivo).
dd bs=1 count="$BLOQUE" of="$dir/cabecera" 2>/dev/null || falla "no se pudo leer la cabecera"
[ "$(tamano "$dir/cabecera")" = "$BLOQUE" ] || falla "la cabecera no trae $BLOQUE bytes"

bytes=""
sha=""
espera=""
terminada=0
n=0
while IFS= read -r linea; do
  if [ "$terminada" = 1 ]; then
    [ -z "$linea" ] || falla "el relleno de la cabecera no es solo de líneas vacías"
    continue
  fi
  if [ -z "$linea" ]; then
    terminada=1
    continue
  fi
  [ "${#linea}" -le "$MAX_LARGO" ] || falla "una línea de la cabecera pasa de $MAX_LARGO caracteres"
  [ "$(printf '%s' "$linea" | LC_ALL=C tr -d '\001-\037\177')" = "$linea" ] || falla "la cabecera tiene un carácter de control"
  case "$espera" in
    bytes) bytes="$linea" espera="" ; continue ;;
    sha) sha="$linea" espera="" ; continue ;;
  esac
  case "$linea" in
    --bytes) [ -z "$bytes" ] || falla "--bytes repetido"; espera=bytes ;;
    --sha256) [ -z "$sha" ] || falla "--sha256 repetido"; espera=sha ;;
    *)
      n=$((n + 1))
      [ "$n" -le "$MAX_ARGUMENTOS" ] || falla "la cabecera pasa de $MAX_ARGUMENTOS argumentos"
      set -- "$@" "$linea"
      ;;
  esac
done <"$dir/cabecera"
rm -f "$dir/cabecera"
[ "$terminada" = 1 ] || falla "la cabecera no termina en una línea vacía"
[ -z "$espera" ] || falla "falta el valor de --$espera"

correo_valido() {
  case "$1" in
    -* | *[[:space:]]* | *@*@* | @* | *@) return 1 ;;
    ?*@?*.?*) return 0 ;;
    *) return 1 ;;
  esac
}
# La forma; si la fecha existe lo decide el CLI.
fecha_valida() {
  case "$1" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) return 0 ;;
    *) return 1 ;;
  esac
}
# El código de la SFC del fondo: de 1 a 12 dígitos (CODIGO_FIC_RE de src/fondo/sfc.ts).
fondo_valido() {
  case "$1" in '' | *[!0-9]*) return 1 ;; esac
  [ "${#1}" -le 12 ]
}

# Los comandos con archivo: lista blanca de opciones por comando; el contenedor agrega la ruta del temporal.
if [ -n "$archivo" ]; then
  case "$bytes" in '' | *[!0-9]*) falla "falta --bytes <N> del archivo (entero)" ;; esac
  case "$sha" in *[!0-9a-f]*) falla "--sha256 debe ser de 64 hex en minúscula" ;; esac
  [ "${#sha}" = 64 ] || falla "falta --sha256 <H> del archivo (64 hex)"
  [ "$bytes" -gt 0 ] || falla "el archivo está vacío"
  [ "$bytes" -le "$tope" ] || falla "el archivo pasa del tope de $tope bytes"
  correo=""
  aplicar=0
  corte=""
  fondo=""
  while [ $# -gt 0 ]; do
    case "$comando:$1" in
      importar-precios:*) falla "importar-precios no lleva opciones: el CSV de cierres llega en el sobre" ;;
      *:--email)
        [ -z "$correo" ] || falla "--email repetido"
        [ $# -ge 2 ] || falla "--email necesita un correo"
        correo_valido "$2" || falla "--email necesita un correo válido (no una opción)"
        correo="$2"
        shift 2
        ;;
      importar-plan:--aplicar)
        [ "$aplicar" = 0 ] || falla "--aplicar repetido"
        aplicar=1
        shift
        ;;
      importar-certificacion:--fecha-corte)
        [ -z "$corte" ] || falla "--fecha-corte repetido"
        if [ $# -lt 2 ] || ! fecha_valida "$2"; then falla "--fecha-corte necesita una fecha AAAA-MM-DD"; fi
        corte="$2"
        shift 2
        ;;
      importar-certificacion:--fondo)
        [ -z "$fondo" ] || falla "--fondo repetido"
        if [ $# -lt 2 ] || ! fondo_valido "$2"; then falla "--fondo necesita el código numérico del fondo (de 1 a 12 dígitos)"; fi
        fondo="$2"
        shift 2
        ;;
      *:--aplicar) falla "--aplicar no es una opción de $comando" ;;
      *:--crear-dueno) falla "--crear-dueno no se acepta en producción: el dueño lo crea crear-acceso-inicial (orden obligatorio)" ;;
      *) falla "opción no permitida para $comando (se admiten --email; en importar-plan, --aplicar; en importar-certificacion, --fecha-corte y --fondo)" ;;
    esac
  done
  [ "$comando" = importar-precios ] || [ -n "$correo" ] || falla "falta --email <correo-del-dueño>"
  [ "$comando" != importar-certificacion ] || [ -n "$corte" ] || falla "falta --fecha-corte AAAA-MM-DD"
  # El archivo: exactamente N bytes y su sha256 (frena un archivo truncado por un corte del SSH).
  head -c "$bytes" >"$dir/$archivo" || falla "no se pudo leer el archivo"
  [ "$(tamano "$dir/$archivo")" = "$bytes" ] || falla "el archivo llegó incompleto (corte del SSH): no se carga nada"
  [ "$(sha256 "$dir/$archivo")" = "$sha" ] || falla "el sha256 del archivo no cuadra con el del Mac: no se carga nada"
  case "$comando" in
    importar-trii) set -- --email "$correo" "$dir/$archivo" ;;
    importar-plan)
      if [ "$aplicar" = 1 ]; then set -- --ficha "$dir/$archivo" --email "$correo" --aplicar; else set -- --ficha "$dir/$archivo" --email "$correo"; fi
      ;;
    importar-certificacion)
      # El PDF va al final: es el argumento suelto del CLI (y su nombre termina en .pdf, como exige).
      if [ -n "$fondo" ]; then set -- --email "$correo" --fecha-corte "$corte" --fondo "$fondo" "$dir/$archivo"; else set -- --email "$correo" --fecha-corte "$corte" "$dir/$archivo"; fi
      ;;
    importar-precios) set -- --archivo "$dir/$archivo" ;;
  esac
else
  [ -z "$bytes$sha" ] || falla "$comando no lleva archivo (sobran --bytes o --sha256)"
fi

# El CLI en segundo plano con su entrada en /dev/null: el trap corre aunque llegue una señal, y la reenvía.
cd "$APP_DIR"
node_modules/.bin/tsx "$cli" "$@" </dev/null &
hijo=$!
rc=0
wait "$hijo" || rc=$?
hijo=""
limpiar
exit "$rc"
