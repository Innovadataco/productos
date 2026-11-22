#!/bin/sh
# Inversiones · carga sin copias en el VPS, dentro del contenedor del migrador (/usr/local/bin/inv-cargar).
# Lo llama scripts/cargar-prod.sh con `run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar <comando>`
# y el sobre por la entrada estándar (lo arma scripts/armar-sobre.sh en el Mac):
#   - cabecera de EXACTAMENTE 4096 bytes: un argumento por línea, una línea vacía y relleno de líneas vacías. Con
#     archivo trae --bytes <N> y --sha256 <H>, que se consumen aquí y no pasan al CLI;
#   - el archivo (importar-trii, importar-plan, importar-certificacion, corregir-corte-certificacion, importar-precios,
#     importar-valores-fondo, importar-series, importar-decretos y registrar-rendimientos-fondo).
# Antes de leer nada comprueba que el contenedor no use swap: el temporal vive en el tmpfs /tmp, que con
# mem = memswap no baja al disco. El archivo queda en un temporal 600 dentro de una carpeta 700 con nombre fijo
# (trii.csv, ficha.md, certificacion.pdf, precios.csv, valores-fondo.csv, series.csv, decretos.csv o
# rendimientos-fondo.csv: el nombre real no llega a la base), corre el CLI y lo borra SIEMPRE (trap), también si el
# CLI falla o llega una señal. El tmpfs muere con el contenedor. `exportar-hechos-ia` no lleva archivo ni opciones: su
# CLI (solo lectura) imprime el JSON por stdout, que este script no toca (sus mensajes van a stderr).
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
# Los seis siguientes son los topes de sus CLI (una sola fuente; tests/unit/produccion/cargar-contenedor.test.ts,
# cargar-fondo.test.ts, cargar-datos-oficiales.test.ts y cargar-rendimientos-fondo.test.ts los comparan): MAX_BYTES del
# PDF (src/importacion/av/pdf/documento.ts), MAX_BYTES_CSV (src/precios/csv-cierres.ts), MAX_BYTES_CSV_FONDO
# (src/fondo/csv-valores.ts), MAX_BYTES_CSV_SERIES (src/datos-oficiales/series/csv-series.ts), MAX_BYTES_DECRETOS
# (src/datos-oficiales/decretos/csv.ts) y MAX_BYTES_RENDIMIENTOS (src/fondo/rendimientos/csv.ts).
TOPE_CERTIFICACION=15728640
TOPE_PRECIOS=4194304
TOPE_VALORES_FONDO=2097152
TOPE_SERIES=2097152
TOPE_DECRETOS=1048576
TOPE_RENDIMIENTOS_FONDO=262144

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
condiciones=""
case "$comando" in
  importar-trii) cli=scripts/importar-trii.ts archivo=trii.csv tope=$TOPE_TRII ;;
  importar-plan) cli=scripts/importar-plan.ts archivo=ficha.md tope=$TOPE_FICHA ;;
  importar-certificacion) cli=scripts/importar-certificacion.ts archivo=certificacion.pdf tope=$TOPE_CERTIFICACION ;;
  corregir-corte-certificacion) cli=scripts/corregir-corte-certificacion.ts archivo=certificacion.pdf tope=$TOPE_CERTIFICACION ;;
  importar-precios) cli=scripts/importar-precios.ts archivo=precios.csv tope=$TOPE_PRECIOS ;;
  importar-valores-fondo) cli=scripts/importar-valores-fondo.ts archivo=valores-fondo.csv tope=$TOPE_VALORES_FONDO ;;
  importar-series) cli=scripts/importar-series.ts archivo=series.csv tope=$TOPE_SERIES ;;
  importar-decretos) cli=scripts/importar-decretos.ts archivo=decretos.csv tope=$TOPE_DECRETOS ;;
  registrar-rendimientos-fondo) cli=scripts/registrar-rendimientos-fondo.ts archivo=rendimientos-fondo.csv tope=$TOPE_RENDIMIENTOS_FONDO ;;
  registrar-escision) cli=scripts/registrar-escision.ts ;;
  registrar-fondo) cli=scripts/actualizar-fondo.ts ;;
  registrar-movimiento-fondo) cli=scripts/registrar-movimiento-fondo.ts ;;
  lote-escision) cli=scripts/lote-escision.ts ;;
  construir-lotes) cli=scripts/construir-lotes.ts ;;
  conciliar-certificacion) cli=scripts/conciliar-certificacion.ts ;;
  # El export de hechos de la IA (E7): solo lectura, sin archivo ni opciones; su JSON sale por stdout. Sus lectores
  # importan "server-only", que fuera de Next solo carga con la condición react-server.
  exportar-hechos-ia) cli=scripts/exportar-hechos-ia.ts condiciones=--conditions=react-server ;;
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
# La clase del fondo en la SFC (tipo_participacion): de 1 a 6 dígitos (PARTICIPACION_RE de src/fondo/sfc.ts).
participacion_valida() {
  case "$1" in '' | *[!0-9]*) return 1 ;; esac
  [ "${#1}" -le 6 ]
}
# Unidades y monto de registrar-movimiento-fondo: solo la forma (dígitos, con un punto y dígitos a los dos lados; sin
# signo, coma, exponente ni miles) y hasta MAX_DECIMAL caracteres. La precisión, el rango y el signo los decide el CLI
# (validarConstitucion, en src/fondo/movimiento.ts, que quita los ceros sobrantes antes de contar).
MAX_DECIMAL=40
decimal_valido() {
  case "$1" in '' | .* | *. | *[!0-9.]* | *.*.*) return 1 ;; esac
  [ "${#1}" -le "$MAX_DECIMAL" ]
}
# El nombre del fondo: no vacío, sin «-» al inicio (el CLI lo tomaría por una opción), sin caracteres de control y
# de hasta MAX_NOMBRE_FONDO bytes, contados en C (no dependen del locale ni del shell). Es un tope grueso: el CLI
# (validarRegistroFondo, en src/fondo/registrar.ts) manda y admite hasta 120 caracteres.
MAX_NOMBRE_FONDO=200
nombre_valido() {
  case "$1" in '' | -*) return 1 ;; esac
  [ "$(printf '%s' "$1" | LC_ALL=C tr -d '\001-\037\177')" = "$1" ] || return 1
  [ "$(printf '%s' "$1" | LC_ALL=C wc -c | tr -d ' ')" -le "$MAX_NOMBRE_FONDO" ]
}

# Los comandos con archivo: lista blanca de opciones por comando; el contenedor agrega la ruta del temporal.
if [ -n "$archivo" ]; then
  case "$bytes" in '' | *[!0-9]*) falla "falta --bytes <N> del archivo (entero)" ;; esac
  # Antes de compararlo: un entero de más de 10 dígitos no cabe en `test` (y ningún tope llega a 10 dígitos).
  [ "${#bytes}" -le 10 ] || falla "--bytes fuera de rango"
  case "$sha" in *[!0-9a-f]*) falla "--sha256 debe ser de 64 hex en minúscula" ;; esac
  [ "${#sha}" = 64 ] || falla "falta --sha256 <H> del archivo (64 hex)"
  [ "$bytes" -gt 0 ] || falla "el archivo está vacío"
  [ "$bytes" -le "$tope" ] || falla "el archivo pasa del tope de $tope bytes"
  correo=""
  aplicar=0
  corte=""
  nuevo=""
  fondo=""
  while [ $# -gt 0 ]; do
    case "$comando:$1" in
      importar-precios:*) falla "importar-precios no lleva opciones: el CSV de cierres llega en el sobre" ;;
      importar-valores-fondo:*) falla "importar-valores-fondo no lleva opciones: el CSV de valores del fondo llega en el sobre" ;;
      importar-series:*) falla "importar-series no lleva opciones: el CSV de series llega en el sobre" ;;
      *:--email)
        [ -z "$correo" ] || falla "--email repetido"
        [ $# -ge 2 ] || falla "--email necesita un correo"
        correo_valido "$2" || falla "--email necesita un correo válido (no una opción)"
        correo="$2"
        shift 2
        ;;
      importar-plan:--aplicar | importar-decretos:--aplicar | registrar-rendimientos-fondo:--aplicar)
        [ "$aplicar" = 0 ] || falla "--aplicar repetido"
        aplicar=1
        shift
        ;;
      importar-certificacion:--fecha-corte | corregir-corte-certificacion:--fecha-corte)
        [ -z "$corte" ] || falla "--fecha-corte repetido"
        if [ $# -lt 2 ] || ! fecha_valida "$2"; then falla "--fecha-corte necesita una fecha AAAA-MM-DD"; fi
        corte="$2"
        shift 2
        ;;
      corregir-corte-certificacion:--nueva-fecha-corte)
        [ -z "$nuevo" ] || falla "--nueva-fecha-corte repetido"
        if [ $# -lt 2 ] || ! fecha_valida "$2"; then falla "--nueva-fecha-corte necesita una fecha AAAA-MM-DD"; fi
        nuevo="$2"
        shift 2
        ;;
      importar-certificacion:--fondo | registrar-rendimientos-fondo:--fondo)
        [ -z "$fondo" ] || falla "--fondo repetido"
        if [ $# -lt 2 ] || ! fondo_valido "$2"; then falla "--fondo necesita el código numérico del fondo (de 1 a 12 dígitos)"; fi
        fondo="$2"
        shift 2
        ;;
      *:--aplicar) falla "--aplicar no es una opción de $comando" ;;
      *:--crear-dueno) falla "--crear-dueno no se acepta en producción: el dueño lo crea crear-acceso-inicial (orden obligatorio)" ;;
      *) falla "opción no permitida para $comando (se admiten --email; en importar-plan e importar-decretos, --aplicar; en importar-certificacion, --fecha-corte y --fondo; en corregir-corte-certificacion, --fecha-corte y --nueva-fecha-corte; en registrar-rendimientos-fondo, --fondo y --aplicar)" ;;
    esac
  done
  case "$comando" in importar-precios | importar-valores-fondo | importar-series) ;; *) [ -n "$correo" ] || falla "falta --email <correo-del-dueño>" ;; esac
  case "$comando" in importar-certificacion | corregir-corte-certificacion) [ -n "$corte" ] || falla "falta --fecha-corte AAAA-MM-DD" ;; esac
  [ "$comando" != corregir-corte-certificacion ] || [ -n "$nuevo" ] || falla "falta --nueva-fecha-corte AAAA-MM-DD"
  [ "$comando" != registrar-rendimientos-fondo ] || [ -n "$fondo" ] || falla "falta --fondo <código del fondo en la SFC>"
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
    # El mismo PDF que se cargó, al final; sin --fondo (el fondo ya quedó vinculado).
    corregir-corte-certificacion) set -- --email "$correo" --fecha-corte "$corte" --nueva-fecha-corte "$nuevo" "$dir/$archivo" ;;
    importar-precios | importar-valores-fondo | importar-series) set -- --archivo "$dir/$archivo" ;;
    # El CSV con --archivo (decretos.csv termina en .csv, como exige el CLI), el correo y --aplicar solo si vino: sin él,
    # el CLI hace el ensayo. Si --aplicar puede escribir en esa base lo decide el CLI, no el sobre.
    importar-decretos)
      if [ "$aplicar" = 1 ]; then set -- --archivo "$dir/$archivo" --email "$correo" --aplicar; else set -- --archivo "$dir/$archivo" --email "$correo"; fi
      ;;
    # Los rendimientos del fondo: el CSV con --archivo (rendimientos-fondo.csv termina en .csv), el correo, el código del
    # fondo y --aplicar solo si vino (sin él, el CLI hace el ensayo). El rango y los valores los decide el CLI.
    registrar-rendimientos-fondo)
      if [ "$aplicar" = 1 ]; then
        set -- --archivo "$dir/$archivo" --email "$correo" --fondo "$fondo" --aplicar
      else
        set -- --archivo "$dir/$archivo" --email "$correo" --fondo "$fondo"
      fi
      ;;
  esac
else
  [ -z "$bytes$sha" ] || falla "$comando no lleva archivo (sobran --bytes o --sha256)"
  # registrar-fondo: lista blanca propia. El contenedor arma `--registrar --codigo … [--participacion …] --nombre …`
  # en ese orden: el modo con red de actualizar-fondo (--desde, --hasta) nunca llega al CLI.
  if [ "$comando" = registrar-fondo ]; then
    codigo=""
    participacion=""
    nombre=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --codigo)
          [ -z "$codigo" ] || falla "--codigo repetido"
          if [ $# -lt 2 ] || ! fondo_valido "$2"; then falla "--codigo necesita el código numérico del fondo en la SFC (de 1 a 12 dígitos)"; fi
          codigo="$2"
          shift 2
          ;;
        --participacion)
          [ -z "$participacion" ] || falla "--participacion repetido"
          if [ $# -lt 2 ] || ! participacion_valida "$2"; then falla "--participacion necesita la clase numérica del fondo en la SFC (de 1 a 6 dígitos)"; fi
          participacion="$2"
          shift 2
          ;;
        --nombre)
          [ -z "$nombre" ] || falla "--nombre repetido"
          if [ $# -lt 2 ] || ! nombre_valido "$2"; then falla "--nombre necesita un texto de 1 a $MAX_NOMBRE_FONDO bytes, sin caracteres de control y que no empiece por «-»"; fi
          nombre="$2"
          shift 2
          ;;
        *) falla "opción no permitida para registrar-fondo (se admiten --codigo, --participacion y --nombre)" ;;
      esac
    done
    [ -n "$codigo" ] || falla "falta --codigo <código del fondo en la SFC>"
    [ -n "$nombre" ] || falla "falta --nombre <nombre del fondo>"
    if [ -n "$participacion" ]; then
      set -- --registrar --codigo "$codigo" --participacion "$participacion" --nombre "$nombre"
    else
      set -- --registrar --codigo "$codigo" --nombre "$nombre"
    fi
  fi
  # registrar-movimiento-fondo (la constitución del fondo): lista blanca propia, cada opción una vez y las cinco con
  # valor obligatorias. El contenedor arma `--email … --fondo … --fecha … --unidades … --monto … [--aplicar]` en ese
  # orden; sin --aplicar, el CLI hace el ensayo. Ningún mensaje repite un valor (unidades y monto son datos del dueño).
  if [ "$comando" = registrar-movimiento-fondo ]; then
    correo=""
    fondo=""
    fecha=""
    unidades=""
    monto=""
    aplicar=0
    while [ $# -gt 0 ]; do
      case "$1" in
        --email)
          [ -z "$correo" ] || falla "--email repetido"
          if [ $# -lt 2 ] || ! correo_valido "$2"; then falla "--email necesita un correo válido (no una opción)"; fi
          correo="$2"
          shift 2
          ;;
        --fondo)
          [ -z "$fondo" ] || falla "--fondo repetido"
          if [ $# -lt 2 ] || ! fondo_valido "$2"; then falla "--fondo necesita el código numérico del fondo en la SFC (de 1 a 12 dígitos)"; fi
          fondo="$2"
          shift 2
          ;;
        --fecha)
          [ -z "$fecha" ] || falla "--fecha repetido"
          if [ $# -lt 2 ] || ! fecha_valida "$2"; then falla "--fecha necesita una fecha AAAA-MM-DD"; fi
          fecha="$2"
          shift 2
          ;;
        --unidades)
          [ -z "$unidades" ] || falla "--unidades repetido"
          if [ $# -lt 2 ] || ! decimal_valido "$2"; then falla "--unidades necesita un número con punto decimal (sin signo, coma, exponente ni miles; hasta $MAX_DECIMAL caracteres)"; fi
          unidades="$2"
          shift 2
          ;;
        --monto)
          [ -z "$monto" ] || falla "--monto repetido"
          if [ $# -lt 2 ] || ! decimal_valido "$2"; then falla "--monto necesita un número con punto decimal (sin signo, coma, exponente ni miles; hasta $MAX_DECIMAL caracteres)"; fi
          monto="$2"
          shift 2
          ;;
        --aplicar)
          [ "$aplicar" = 0 ] || falla "--aplicar repetido"
          aplicar=1
          shift
          ;;
        *) falla "opción no permitida para registrar-movimiento-fondo (se admiten --email, --fondo, --fecha, --unidades, --monto y --aplicar)" ;;
      esac
    done
    [ -n "$correo" ] || falla "falta --email <correo-del-dueño>"
    [ -n "$fondo" ] || falla "falta --fondo <código del fondo en la SFC>"
    [ -n "$fecha" ] || falla "falta --fecha AAAA-MM-DD"
    [ -n "$unidades" ] || falla "falta --unidades <n>"
    [ -n "$monto" ] || falla "falta --monto <n>"
    set -- --email "$correo" --fondo "$fondo" --fecha "$fecha" --unidades "$unidades" --monto "$monto"
    [ "$aplicar" = 0 ] || set -- "$@" --aplicar
  fi
  # exportar-hechos-ia: ni opciones ni argumentos (nunca --aplicar: no escribe).
  if [ "$comando" = exportar-hechos-ia ] && [ $# -ne 0 ]; then
    falla "exportar-hechos-ia no lleva opciones ni argumentos"
  fi
  # conciliar-certificacion: lista blanca también aquí (defensa en profundidad; su CLI ya es estricto). Los otros
  # comandos sin archivo pasan sus argumentos tal cual a su CLI estricto.
  if [ "$comando" = conciliar-certificacion ]; then
    if [ $# -ne 2 ] || [ "$1" != --fecha-corte ] || ! fecha_valida "$2"; then
      falla "conciliar-certificacion lleva solo --fecha-corte AAAA-MM-DD"
    fi
  fi
fi

# El CLI en segundo plano con su entrada en /dev/null: el trap corre aunque llegue una señal, y la reenvía.
cd "$APP_DIR"
node_modules/.bin/tsx ${condiciones:+"$condiciones"} "$cli" "$@" </dev/null &
hijo=$!
rc=0
wait "$hijo" || rc=$?
hijo=""
limpiar
exit "$rc"
