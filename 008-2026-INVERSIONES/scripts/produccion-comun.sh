# shellcheck shell=bash
# Inversiones · funciones comunes de los scripts de producción. Se carga con `source`; no se ejecuta.
#
# Candados (orden de Jelk: «no tocar gesmovil ni pi, solo inversiones, ojo no puede dañar nada»):
#  - Docker solo con el proyecto inv-008-prod (o inv-008-prueba en local), siempre por la variable COMPOSE (o
#    COMPOSE_PAUSA, solo para el down de la pausa). Única excepción: `docker update` de los límites (mem = memswap) en
#    reaplicar_limites, a un contenedor que salió de COMPOSE y lleva la etiqueta del proyecto.
#  - La raíz de producción NO está escrita en el repo (es público): es la carpeta que contiene al clon,
#    <raíz>/repo/008-2026-INVERSIONES (el valor real, en el ESTADO de la gestión). Sus anclas son fatales: el clon
#    se llama repo, la raíz y sus padres son solo de root, y el archivo de producción es de root, 600 y regular.
#  - Toda escritura en disco, bajo la raíz (resuelta físicamente, sin «..» ni enlaces que salgan). Solo dos
#    excepciones, acordadas con el CEO de PI: el candado común (INV_CANDADO_COMUN_PROD, contrato con PI) y la
#    carpeta de respaldos cifrados (esa carpeta, sin subcarpetas), que sale de la configuración no secreta
#    <raíz>/inv-008.conf, validada.
#  - El modo de prueba (inv-008-prueba) solo corre en el Mac o en el CI, nunca como root ni donde la raíz
#    derivada del clon tenga el archivo de producción (el VPS).
#  - El archivo de producción y la configuración se leen línea por línea, nunca con `source`.
#  - Sin volcados de memoria (ulimit -c 0): en el VPS un core iría al disco con lo que el proceso tenía.

ulimit -c 0

INV_PROYECTO_PROD="inv-008-prod"
INV_PROYECTO_PRUEBA="inv-008-prueba"
INV_REPO_GITHUB="Innovadataco/productos"
INV_CANDADO_COMUN_PROD="/var/lock/despliegue-vps.lock"
# Valor por defecto de la carpeta de respaldos (el mismo del compose): una ruta que no existe. Con él ningún
# comando de Compose falla al interpolar, y un up que cree el respaldo sin la carpeta configurada falla cerrado.
INV_RESPALDOS_CENTINELA="/nonexistent/inv-008-respaldos-sin-configurar"
# Criterio de corte de convivencia con PI: MemAvailable en reposo bajo 1 GiB.
UMBRAL_CORTE_KB=1048576
# Montaje del HOST de la carpeta de respaldos sin nosuid o noexec: 0 = solo avisa; 1 = aborta. Queda en 0 hasta
# que el CEO de PI confirme que montó la carpeta así; entonces se cambia a 1 (un PR de una línea). Nunca por
# variable de entorno: es una decisión del repo, no de quien corre el script.
INV_MONTAJE_RESPALDOS_FATAL=0
# Caracteres permitidos en las rutas que derivan los scripts (van a mensajes y a comandos de root).
INV_RUTA_SEGURA='^/[A-Za-z0-9_./-]+$'
INV_DIR_008="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

morir() {
  printf '❌ [%s] %s\n' "${INV_SCRIPT:-inversiones}" "$*" >&2
  exit 1
}

informar() {
  printf '[%s] %s\n' "${INV_SCRIPT:-inversiones}" "$*" >&2
}

# Imprime la raíz de producción derivada de la carpeta 008 ($1): la carpeta que contiene al clon «repo». Falla
# (sin imprimir nada) si la ruta tiene caracteres fuera de la lista, si el clon no se llama repo, si la carpeta
# no es 008-2026-INVERSIONES o si la raíz sería /.
raiz_derivada() {
  local dir008="$1" clon raiz
  [[ "$dir008" =~ $INV_RUTA_SEGURA ]] || return 1
  case "$dir008/" in *//* | */./* | */../*) return 1 ;; esac
  [ "${dir008##*/}" = "008-2026-INVERSIONES" ] || return 1
  clon="${dir008%/*}"
  [ "${clon##*/}" = "repo" ] || return 1
  raiz="${clon%/*}"
  [ -n "$raiz" ] && [ "$raiz" != "/" ] || return 1
  printf '%s' "$raiz"
}

# Imprime, una por línea, las anclas rotas de la raíz de producción ($2): ella y sus padres hasta $4 (en
# producción, /) deben ser de $1, sin escritura del grupo ni de otros y sin enlaces; el archivo de producción
# ($3) debe existir, ser regular, de $1 y sin lectura ni escritura del grupo ni de otros (600). Sin salida = sanas.
anclas_inseguras() {
  local dueno="$1" raiz="$2" archivo_prod="$3" tope="${4:-/}" ruta="$2"
  while :; do
    find "$ruta" -maxdepth 0 \( ! -user "$dueno" -o -perm -0020 -o -perm -0002 -o -type l \) -print 2>/dev/null ||
      printf '%s (no se pudo revisar)\n' "$ruta"
    { [ "$ruta" != "$tope" ] && [ "$ruta" != "/" ]; } || break
    ruta="$(dirname "$ruta")"
  done
  if [ -L "$archivo_prod" ] || [ ! -f "$archivo_prod" ]; then
    printf '%s (falta o no es un archivo regular)\n' "$archivo_prod"
  else
    find "$archivo_prod" -maxdepth 0 \( ! -user "$dueno" -o -perm -0040 -o -perm -0004 -o -perm -0020 -o -perm -0002 \) -print ||
      printf '%s (no se pudo revisar)\n' "$archivo_prod"
  fi
  return 0
}

# Fija el proyecto y la raíz de escritura. En producción la raíz se deriva de la ubicación del clon y sus anclas
# son fatales; con --pausa no matan: dejan INV_ANCLAS_OK=0 y la pausa hace un down de último recurso sin
# escribir nada. INV_BASE e INV_COMPOSE_OVERRIDE solo valen con el proyecto de prueba (en el Mac o el CI).
preparar_entorno() {
  local modo="${1:-}" malas
  INV_PROYECTO_ACTIVO="${INV_PROYECTO:-$INV_PROYECTO_PROD}"
  INV_ANCLAS_OK=1
  INV_RESPALDOS_DIR=""
  INV_RESPALDOS_PROD=""
  case "$INV_PROYECTO_ACTIVO" in
    "$INV_PROYECTO_PROD")
      [ -z "${INV_BASE:-}" ] || morir "INV_BASE solo se acepta con el proyecto $INV_PROYECTO_PRUEBA"
      [ -z "${INV_COMPOSE_OVERRIDE:-}" ] || morir "INV_COMPOSE_OVERRIDE solo se acepta con el proyecto $INV_PROYECTO_PRUEBA"
      COMPOSE_PAUSA=(docker compose -p "$INV_PROYECTO_ACTIVO")
      if ! INV_RAIZ="$(raiz_derivada "$INV_DIR_008")"; then
        INV_RAIZ=""
        malas="el clon no está en <raíz>/repo/008-2026-INVERSIONES con una ruta de caracteres [A-Za-z0-9_./-]: $INV_DIR_008"
      else
        malas="$(anclas_inseguras root "$INV_RAIZ" "$INV_RAIZ/.env.inversiones.production")"
      fi
      if [ -n "$malas" ]; then
        malas="$(printf '%s\n' "$malas" | tr '\n' ' ')"
        [ "$modo" = "--pausa" ] || morir "anclas de la raíz de producción rotas (raíz y padres solo de root; archivo de producción de root, 600 y regular): ${malas}· no se corre"
        INV_ANCLAS_OK=0
        INV_ANCLAS_MALAS="$malas"
        return 0
      fi
      ;;
    "$INV_PROYECTO_PRUEBA")
      modo_prueba_permitido "$(dirname "$(dirname "$INV_DIR_008")")" "$(uname -s)" "${GITHUB_ACTIONS:-}" "$(id -u)" ||
        morir "el proyecto $INV_PROYECTO_PRUEBA solo corre en el Mac o en el CI, nunca como root ni desde un clon dentro de la raíz de producción"
      [ -n "${INV_BASE:-}" ] || morir "con $INV_PROYECTO_PRUEBA hay que definir INV_BASE (carpeta de prueba)"
      INV_RAIZ="$INV_BASE"
      COMPOSE_PAUSA=(docker compose -p "$INV_PROYECTO_ACTIVO")
      ;;
    *)
      morir "proyecto no permitido: «$INV_PROYECTO_ACTIVO». Solo $INV_PROYECTO_PROD (o $INV_PROYECTO_PRUEBA en local); nunca inv-008, el de desarrollo"
      ;;
  esac
  INV_ENV_PROD="$INV_RAIZ/.env.inversiones.production"
  INV_CONF="$INV_RAIZ/inv-008.conf"
  INV_MARCA_PAUSA="$INV_RAIZ/estado/pausado"
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    INV_CANDADO_COMUN="$INV_CANDADO_COMUN_PROD"
  else
    INV_CANDADO_COMUN="$INV_RAIZ/var-lock/despliegue-vps.lock"
  fi
  INV_ESTADO_DIR="$INV_RAIZ/estado"
}

# Imprime, una por línea, las rutas de las que depende lo que corre con sudo y que alguien distinto de $1
# podría cambiar: de otro dueño, con escritura del grupo o de otros, o enlaces simbólicos. Sin salida = sano.
#  - los padres de la carpeta 008 ($3), sin recursión, hasta $2 (en producción, /): quien escribe en un padre
#    puede cambiar la carpeta entera;
#  - scripts/ (recursivo) y el compose: es lo que corre y lo que decide qué contenedores corren;
#  - .git, .git/config y .git/hooks del clon: `git status` como root puede correr core.fsmonitor o el hook
#    post-index-change;
#  - el archivo de producción ($4): además, sin lectura del grupo ni de otros (600);
#  - la configuración no secreta ($5, opcional) si existe: decide el único bind de escritura del respaldo.
# Solo -perm -NNNN y -user: igual en el find de GNU (VPS) y en el de BSD (Mac).
rutas_inseguras() {
  local dueno="$1" tope="$2" dir008="$3" archivo_prod="$4" conf="${5:-}" repo ruta
  repo="$(dirname "$dir008")"
  ruta="$dir008"
  while :; do
    find "$ruta" -maxdepth 0 \( ! -user "$dueno" -o -perm -0020 -o -perm -0002 -o -type l \) -print ||
      printf '%s (no se pudo revisar)\n' "$ruta"
    { [ "$ruta" != "$tope" ] && [ "$ruta" != "/" ]; } || break
    ruta="$(dirname "$ruta")"
  done
  for ruta in "$dir008/scripts" "$dir008/docker-compose.prod.yml"; do
    if [ ! -e "$ruta" ] && [ ! -L "$ruta" ]; then printf '%s (no existe)\n' "$ruta"; continue; fi
    find "$ruta" \( ! -user "$dueno" -o -perm -0020 -o -perm -0002 -o -type l \) -print || printf '%s (no se pudo revisar)\n' "$ruta"
  done
  if [ -e "$repo/.git" ] || [ -L "$repo/.git" ]; then
    find "$repo/.git" -maxdepth 0 \( ! -user "$dueno" -o -perm -0020 -o -perm -0002 -o -type l \) -print || printf '%s (no se pudo revisar)\n' "$repo/.git"
  fi
  for ruta in "$repo/.git/config" "$repo/.git/hooks"; do
    [ -e "$ruta" ] || [ -L "$ruta" ] || continue
    find "$ruta" \( ! -user "$dueno" -o -perm -0020 -o -perm -0002 -o -type l \) -print || printf '%s (no se pudo revisar)\n' "$ruta"
  done
  if [ -e "$archivo_prod" ] || [ -L "$archivo_prod" ]; then
    find "$archivo_prod" -maxdepth 0 \( ! -user "$dueno" -o -perm -0040 -o -perm -0004 -o -perm -0020 -o -perm -0002 -o -type l \) -print ||
      printf '%s (no se pudo revisar)\n' "$archivo_prod"
  fi
  if [ -n "$conf" ] && { [ -e "$conf" ] || [ -L "$conf" ]; }; then
    find "$conf" -maxdepth 0 \( ! -user "$dueno" -o -perm -0020 -o -perm -0002 -o -type l \) -print || printf '%s (no se pudo revisar)\n' "$conf"
  fi
  return 0
}

# Primera revisión de todo script con sudo en producción, justo después de preparar_entorno: aborta si lo que
# corre como root (o lo decide) no es solo de root. Con --solo-avisar (pausar-008.sh) solo avisa, para no
# frenar un corte de emergencia. En el proyecto de prueba no revisa (en el Mac nada es de root).
# Límite: un script no responde por sí mismo. Cuando esto corre, bash ya leyó el script y este archivo; si
# alguien pudo cambiarlos, también pudo quitar esta revisión. Lo que sí cuida: los scripts, el compose y el
# SQL que se leen después, la cadena de padres y la configuración de git, ante un permiso mal puesto.
revisar_arbol() {
  local malas
  [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ] || return 0
  malas="$(rutas_inseguras root / "$INV_DIR_008" "${INV_ENV_PROD:-}" "${INV_CONF:-}")"
  [ -n "$malas" ] || return 0
  malas="$(printf '%s\n' "$malas" | tr '\n' ' ')"
  if [ "${1:-}" = "--solo-avisar" ]; then
    informar "⚠️  rutas que no son solo de root (otro dueño, escritura del grupo u otros, enlaces, o el archivo de producción sin 600): ${malas}· se sigue: la pausa no se frena"
    return 0
  fi
  morir "rutas que no son solo de root (otro dueño, escritura del grupo u otros, enlaces, o el archivo de producción sin 600): ${malas}· no se corre con sudo"
}

# Imprime el problema de la forma o del contenido de la carpeta de respaldos $1, o nada si está bien: ruta
# absoluta de caracteres [A-Za-z0-9_./-], sin //, . ni .., sin / final, sin enlaces en ningún componente, una
# carpeta que existe y que solo tiene respaldos de 008 (los nombres de docker/respaldo/respaldo.sh). Nunca
# nombra lo que hay dentro: solo cuenta. El contenido se recorre con un glob en una subshell (un nombre con
# salto de línea es UNA entrada, y cuenta como ajena); si la carpeta no se puede listar, falla cerrado.
problema_ruta_respaldos() {
  local dir="$1" parcial="" componente resto ajenas
  [[ "$dir" =~ $INV_RUTA_SEGURA ]] || { echo "no es una ruta absoluta con caracteres [A-Za-z0-9_./-]"; return 0; }
  case "$dir/" in *//* | */./* | */../*) echo "tiene //, . o .."; return 0 ;; esac
  [ "$dir" != "/" ] || { echo "es /"; return 0; }
  resto="${dir#/}"
  while [ -n "$resto" ]; do
    componente="${resto%%/*}"
    parcial="$parcial/$componente"
    [ ! -L "$parcial" ] || { echo "tiene un enlace simbólico en el camino"; return 0; }
    [ "$resto" != "$componente" ] || break
    resto="${resto#*/}"
  done
  [ -d "$dir" ] || { echo "no es una carpeta que exista"; return 0; }
  [ -r "$dir" ] && [ -x "$dir" ] || { echo "no se puede listar (sin permiso de lectura)"; return 0; }
  ajenas="$(
    shopt -s nullglob dotglob
    n=0
    for entrada in "$dir"/*; do
      nombre="${entrada##*/}"
      [[ "$nombre" =~ ^inv-008-[0-9]{8}-[0-9]{6}(-[a-z0-9-]+)?\.dump\.age(\.sha256)?$ ]] && continue
      [[ "$nombre" =~ ^\.inv-008-[0-9]{8}-[0-9]{6}(-[a-z0-9-]+)?\.dump\.age\.[0-9]+\.parcial$ ]] && continue
      [ "$nombre" = ".ultimo-diario" ] && continue
      n=$((n + 1))
    done
    printf '%s' "$n"
  )" || { echo "no se puede listar"; return 0; }
  [[ "$ajenas" =~ ^[0-9]+$ ]] || { echo "no se puede listar"; return 0; }
  [ "$ajenas" = 0 ] || echo "tiene $ajenas entrada(s) que no son respaldos de 008"
}

# Imprime el problema de lugar de la carpeta de respaldos $1 respecto de la raíz $2, o nada. En producción ($3)
# no puede ser la raíz, ni quedar dentro de ella, ni ser un ancestro suyo; en prueba debe quedar DENTRO de ella.
problema_lugar_respaldos() {
  local dir="$1" raiz="$2" proyecto="$3"
  if [ "$proyecto" = "$INV_PROYECTO_PROD" ]; then
    case "$dir/" in "$raiz"/*) echo "es la raíz de Inversiones o queda dentro de ella"; return 0 ;; esac
    case "$raiz/" in "$dir"/*) echo "es un ancestro de la raíz de Inversiones"; return 0 ;; esac
  else
    case "$dir" in "$raiz"/?*) ;; *) echo "en prueba debe quedar dentro de la raíz de prueba"; return 0 ;; esac
  fi
}

# Imprime el problema de dueño, grupo o permisos de la carpeta de respaldos $1 (en producción), o nada: de $2
# (root), del grupo $3 (INV_RESPALDO_GID, entero mayor que 0: nunca el de root), con los permisos de 750 (el grupo
# lee y entra, sin escribir; nadie más: la copia diaria de IDC la baja con el usuario del grupo), y sus padres
# hasta $4 (/) de $2 y sin escritura del grupo ni de otros. dockerd vuelve a montar la carpeta en cada arranque
# del respaldo: quien escribe en un padre podría cambiarla.
problema_permisos_respaldos() {
  local dir="$1" dueno="$2" gid="$3" tope="${4:-/}" ruta
  [[ "$gid" =~ ^[1-9][0-9]*$ ]] || { echo "INV_RESPALDO_GID no es un gid válido (entero mayor que 0)"; return 0; }
  [ -n "$(find "$dir" -maxdepth 0 -type d -user "$dueno" -group "$gid" -perm -0050 ! -perm -0020 \
    ! -perm -0004 ! -perm -0002 ! -perm -0001 -print 2>/dev/null)" ] ||
    { echo "no es de $dueno con el grupo $gid en 750 (el grupo lee y entra sin escribir; nadie más)"; return 0; }
  ruta="$dir"
  while [ "$ruta" != "$tope" ] && [ "$ruta" != "/" ]; do
    ruta="$(dirname "$ruta")"
    [ -z "$(find "$ruta" -maxdepth 0 \( ! -user "$dueno" -o -perm -0020 -o -perm -0002 -o -type l \) -print 2>/dev/null)" ] ||
      { echo "un padre ($ruta) no es solo de $dueno"; return 0; }
  done
}

# Imprime, separadas por un espacio, las opciones de montaje que faltan entre nosuid y noexec en la lista $1
# (separada por comas, como la da findmnt). Compara opción por opción: «nosuidx» no cuenta como nosuid.
faltan_opciones_montaje() {
  local faltan=() opcion
  for opcion in nosuid noexec; do
    case ",$1," in *",$opcion,"*) ;; *) faltan+=("$opcion") ;; esac
  done
  printf '%s' "${faltan[*]:-}"
}

# Revisa, solo leyendo (findmnt -T), que el montaje del HOST que contiene la carpeta de respaldos $1 sea nosuid y
# noexec. Es la protección real ante un archivo setuid o ejecutable que deje el contenedor de respaldo (root del
# contenedor): las opciones de un bind de Docker no se aplican y solo cubrirían la vista del contenedor. Con
# INV_MONTAJE_RESPALDOS_FATAL=0 avisa y sigue; con 1, aborta.
revisar_montaje_respaldos() {
  local dir="$1" opciones faltan mensaje
  if ! opciones="$(findmnt -no OPTIONS -T "$dir" 2>/dev/null)" || [ -z "$opciones" ]; then
    mensaje="no se pudo leer el montaje del host de la carpeta de respaldos (findmnt): no se sabe si es nosuid,noexec"
  else
    faltan="$(faltan_opciones_montaje "$opciones")"
    [ -n "$faltan" ] || return 0
    mensaje="el montaje del host de la carpeta de respaldos no tiene: $faltan (lo monta el CEO de PI; produccion.md §2)"
  fi
  [ "$INV_MONTAJE_RESPALDOS_FATAL" = 1 ] && morir "$mensaje"
  informar "⚠️  $mensaje · se sigue (por ahora solo se avisa)"
}

# Lee la carpeta de respaldos de la configuración no secreta (INV_CONF) sin ejecutarla: el archivo existe, es
# regular (no un enlace) y trae EXACTAMENTE una línea útil, INV_RESPALDOS_DIR=<ruta> (se admiten comentarios y
# líneas vacías). La valida completa (forma, contenido, lugar y, en producción, dueño, grupo y permisos) y la
# deja en INV_RESPALDOS_DIR; en producción también en INV_RESPALDOS_PROD, la excepción de ruta_escribible.
leer_respaldos_dir() {
  local lineas valor problema gid
  [ -f "$INV_CONF" ] && [ ! -L "$INV_CONF" ] ||
    morir "falta la configuración no secreta $INV_CONF (o no es un archivo regular): ver docs/despliegue/produccion.md §2"
  lineas="$(grep -Ev '^[[:space:]]*(#|$)' "$INV_CONF" || true)"
  { [ "$(printf '%s\n' "$lineas" | wc -l | tr -d ' ')" = 1 ] && [[ "$lineas" == INV_RESPALDOS_DIR=* ]]; } ||
    morir "$INV_CONF debe traer exactamente una línea INV_RESPALDOS_DIR=<ruta> (y nada más que comentarios)"
  valor="${lineas#INV_RESPALDOS_DIR=}"
  problema="$(problema_ruta_respaldos "$valor")"
  [ -z "$problema" ] || morir "la carpeta de respaldos de $INV_CONF $problema"
  problema="$(problema_lugar_respaldos "$valor" "$INV_RAIZ" "$INV_PROYECTO_ACTIVO")"
  [ -z "$problema" ] || morir "la carpeta de respaldos de $INV_CONF $problema"
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    gid="$(leer_variable_env "$INV_ENV_PROD" INV_RESPALDO_GID)" || gid=""
    problema="$(problema_permisos_respaldos "$valor" root "$gid")"
    [ -z "$problema" ] || morir "la carpeta de respaldos de $INV_CONF: $problema"
    revisar_montaje_respaldos "$valor"
    INV_RESPALDOS_PROD="$valor"
  fi
  INV_RESPALDOS_DIR="$valor"
}

# Vuelve a validar la carpeta de respaldos justo antes de un up que la monta (entre la validación y el up pudo
# cambiar). Falla sin morir: quien llama decide (la vuelta atrás informa en vez de morir).
respaldos_siguen_validos() {
  local gid
  [ -n "$(problema_ruta_respaldos "$INV_RESPALDOS_DIR")" ] && return 1
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    gid="$(leer_variable_env "$INV_ENV_PROD" INV_RESPALDO_GID)" || return 1
    [ -z "$(problema_permisos_respaldos "$INV_RESPALDOS_DIR" root "$gid")" ] || return 1
  fi
  return 0
}

# Arma COMPOSE (arreglo): `env` con las dos variables que ponen los scripts (la carpeta de respaldos validada y
# la ruta de la pausa, derivada del clon), el proyecto, el compose de este clon y el archivo de producción SOLO
# para interpolar (ningún servicio usa env_file). La variable de entorno manda sobre --env-file: el archivo de
# producción no puede cambiar la carpeta, y la configuración no puede tocar ningún secreto.
# Con --sin-respaldos no lee la configuración y pasa el centinela (para lo que nunca levanta el respaldo).
armar_compose() {
  [ -r "$INV_ENV_PROD" ] || morir "no se puede leer $INV_ENV_PROD (es 600 de root: corra con sudo)"
  ! grep -Eq '^(INV_RESPALDOS_DIR|INV_RUTA_PAUSA)=' "$INV_ENV_PROD" ||
    morir "el archivo de producción no puede definir INV_RESPALDOS_DIR ni INV_RUTA_PAUSA: las ponen los scripts"
  local respaldos="$INV_RESPALDOS_CENTINELA" pausa="$INV_DIR_008/scripts/pausar-008.sh"
  if [ "${1:-}" != "--sin-respaldos" ]; then
    leer_respaldos_dir
    respaldos="$INV_RESPALDOS_DIR"
  fi
  [[ "$pausa" =~ $INV_RUTA_SEGURA ]] || morir "la ruta del clon tiene caracteres fuera de [A-Za-z0-9_./-]: $INV_DIR_008"
  COMPOSE=(env "INV_RESPALDOS_DIR=$respaldos" "INV_RUTA_PAUSA=$pausa" docker compose -p "$INV_PROYECTO_ACTIVO" -f "$INV_DIR_008/docker-compose.prod.yml")
  if [ -n "${INV_COMPOSE_OVERRIDE:-}" ]; then
    COMPOSE+=(-f "$INV_COMPOSE_OVERRIDE")
  fi
  COMPOSE+=(--env-file "$INV_ENV_PROD")
}

# El modo de prueba se acepta solo si la raíz derivada del clon ($1) no tiene el archivo de producción (en el
# VPS lo tiene), no corre como root ($4 = euid) y el sistema ($2) es Darwin, o Linux dentro de GitHub Actions
# ($3 = true).
modo_prueba_permitido() {
  [ ! -e "$1/.env.inversiones.production" ] || return 1
  [ "${4:-}" != "0" ] || return 1
  [ "$2" = "Darwin" ] || { [ "$2" = "Linux" ] && [ "$3" = "true" ]; }
}

# Imprime la ruta física de $1 si queda bajo INV_RAIZ; si no, aborta. La ruta puede no existir todavía.
# Rechaza rutas relativas, componentes «.» o «..», y cualquier enlace simbólico en el camino.
# En producción hay solo dos excepciones, y ninguna puede ser un enlace simbólico:
#  - exactamente el candado común con PI (INV_CANDADO_COMUN_PROD);
#  - la carpeta de respaldos de la configuración (INV_RESPALDOS_PROD, ya validada) o un archivo directo dentro de
#    ella. Si no se leyó (vacía), no hay excepción: nunca un patrón vacío que acepte cualquier ruta.
ruta_escribible() {
  local ruta="${1%/}" raiz existente resto="" fisica
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    if [ "$ruta" = "$INV_CANDADO_COMUN_PROD" ]; then
      [ ! -L "$ruta" ] || morir "el candado común es un enlace simbólico: $ruta"
      printf '%s\n' "$ruta"
      return 0
    fi
    if [ -n "${INV_RESPALDOS_PROD:-}" ]; then
      case "$ruta" in
        "$INV_RESPALDOS_PROD" | "$INV_RESPALDOS_PROD"/*)
          resto="${ruta#"$INV_RESPALDOS_PROD"}"
          resto="${resto#/}"
          case "$resto" in */* | . | ..) morir "ruta de respaldo no permitida (solo archivos directos en $INV_RESPALDOS_PROD): $ruta" ;; esac
          [ ! -L "$INV_RESPALDOS_PROD" ] || morir "la carpeta de respaldos es un enlace simbólico"
          [ -z "$resto" ] || [ ! -L "$ruta" ] || morir "el respaldo es un enlace simbólico: $ruta"
          printf '%s\n' "$ruta"
          return 0
          ;;
      esac
    fi
  fi
  case "$ruta" in
    /*) ;;
    *) morir "ruta de escritura relativa: $ruta" ;;
  esac
  case "/$ruta/" in
    */../* | */./*) morir "ruta de escritura con «..» o «.»: $ruta" ;;
  esac
  raiz="$(cd -P "$INV_RAIZ" 2>/dev/null && pwd -P)" || morir "no existe la raíz $INV_RAIZ"
  existente="$ruta"
  while [ ! -d "$existente" ] || [ -L "$existente" ]; do
    [ ! -L "$existente" ] || morir "enlace simbólico en la ruta de escritura: $existente"
    resto="/${existente##*/}$resto"
    existente="${existente%/*}"
    [ -n "$existente" ] || existente="/"
  done
  fisica="$(cd -P "$existente" && pwd -P)$resto"
  fisica="${fisica#//}"
  case "$fisica/" in
    "$raiz"/*) printf '%s\n' "$fisica" ;;
    *) morir "ruta de escritura fuera de $INV_RAIZ: $ruta" ;;
  esac
}

# Escribe $2 en el archivo $1 de forma atómica (temporal + mv), dentro de la raíz.
escribir_atomico() {
  local destino tmp
  destino="$(ruta_escribible "$1")"
  mkdir -p "$(dirname "$destino")"
  tmp="$(ruta_escribible "$(dirname "$destino")/.$(basename "$destino").tmp")"
  printf '%s\n' "$2" >"$tmp"
  mv -f "$tmp" "$destino"
}

# Valor de la variable $2 en el archivo $1 (la última aparición), sin comillas externas. No ejecuta nada.
leer_variable_env() {
  local linea valor
  linea="$(grep -E "^${2}=" "$1" | tail -n 1)" || true
  [ -n "$linea" ] || return 1
  valor="${linea#*=}"
  valor="${valor%$'\r'}"
  case "$valor" in
    \"*\") valor="${valor#\"}"; valor="${valor%\"}" ;;
    \'*\') valor="${valor#\'}"; valor="${valor%\'}" ;;
  esac
  printf '%s' "$valor"
}

# La carpeta compartida con PI (INV_IA_DIR_COMPARTIDA del archivo de producción $1), donde PI publica la lista de
# modelos locales permitidos; la app y el servicio de IA la montan en solo lectura. Es opcional: sin la línea (o vacía)
# se monta un volumen vacío y los dos quedan «sin lista de PI». Si está, debe ser una ruta absoluta y sencilla
# (letras, números, punto, guion, guion bajo y barras, sin «..») de una carpeta propia (ni del sistema ni de un solo
# nivel) que YA exista, sin enlaces en su ruta, y que venga del archivo de producción y no del entorno del shell: Docker
# crearía como root una ruta que no existe. Imprime por qué no sirve; sin salida = sirve (o no está). No imprime la ruta.
problema_dir_compartida_ia() {
  local dir real
  # Compose le da prioridad a la variable del shell sobre el --env-file: así entraría una ruta sin revisar.
  if [ -n "${INV_IA_DIR_COMPARTIDA+x}" ]; then
    echo "INV_IA_DIR_COMPARTIDA viene del entorno del shell: debe ir solo en el archivo de producción (quítela del entorno)"
    return 0
  fi
  dir="$(leer_variable_env "$1" INV_IA_DIR_COMPARTIDA)" || return 0
  [ -n "$dir" ] || return 0
  case "$dir" in
    /*) ;;
    *) echo "INV_IA_DIR_COMPARTIDA no es una ruta absoluta"; return 0 ;;
  esac
  if printf '%s' "$dir" | LC_ALL=C grep -q '[^A-Za-z0-9._/-]' || [[ "$dir" == *..* ]] || [[ "$dir" == *//* ]]; then
    echo "INV_IA_DIR_COMPARTIDA trae caracteres fuera de la lista, «..» o barras dobles"
    return 0
  fi
  # Nunca una carpeta del sistema (se montaría, de solo lectura, en un contenedor con salida) ni una de un solo nivel.
  case "${dir%/}/" in
    /etc/* | /root/* | /home/* | /proc/* | /sys/* | /dev/* | /run/* | /boot/* | /var/run/* | /var/lib/docker/* | /var/log/* | /usr/* | /bin/* | /sbin/* | /lib/* | /lib64/*)
      echo "INV_IA_DIR_COMPARTIDA es una carpeta del sistema: no se monta"
      return 0 ;;
  esac
  case "${dir%/}" in
    "" | /[!/]*/?*) ;;
    *) echo "INV_IA_DIR_COMPARTIDA es de un solo nivel: debe ser una carpeta propia, de dos niveles o más"; return 0 ;;
  esac
  [ -n "${dir%/}" ] || { echo "INV_IA_DIR_COMPARTIDA es una carpeta del sistema: no se monta"; return 0; }
  if [ -L "$dir" ] || [ ! -d "$dir" ]; then
    echo "INV_IA_DIR_COMPARTIDA no es una carpeta que exista (o es un enlace): la crea y la llena PI"
    return 0
  fi
  # Ningún padre puede ser un enlace: la ruta escrita debe ser la real.
  real="$(cd "$dir" && pwd -P)" || { echo "INV_IA_DIR_COMPARTIDA no se pudo resolver"; return 0; }
  [ "$real" = "${dir%/}" ] || echo "INV_IA_DIR_COMPARTIDA no es su ruta real (algún padre es un enlace)"
}

# Lee `ps -eo args` por stdin. Imprime OCUPADO si PI (u otro proyecto) está desplegando o construyendo;
# si no, LIBRE. Mira el PROGRAMA (primer y segundo token), no el texto suelto de la línea: un editor o una
# shell que solo mencionan «docker compose» no cuentan. Cuenta:
#  - un deploy-prod.sh en ejecución (como programa o como script de bash/sh);
#  - docker compose / docker build / docker buildx, o los plugins docker-compose y docker-buildx,
#    salvo que sean de Inversiones (llevan inv-008).
hay_despliegue_ajeno() {
  local linea programa segundo script token
  while IFS= read -r linea; do
    case "$linea" in *inv-008*) continue ;; esac
    read -r programa segundo _ <<<"$linea" || true
    programa="${programa##*/}"
    case "$programa" in
      deploy-prod.sh | docker-compose | docker-buildx) echo OCUPADO; return 0 ;;
      bash | sh | dash)
        # El script es el primer argumento que no es una opción (bash -x, -e, -eu…); con -c es texto.
        script=""
        local -a tokens=()
        read -r -a tokens <<<"$linea" || true
        for token in "${tokens[@]:1}"; do
          case "$token" in
            -c) break ;;
            -*) continue ;;
            *) script="${token##*/}"; break ;;
          esac
        done
        if [ "$script" = "deploy-prod.sh" ]; then echo OCUPADO; return 0; fi ;;
      docker)
        case "${segundo##*/}" in compose | build | buildx) echo OCUPADO; return 0 ;; esac ;;
    esac
  done
  echo LIBRE
}

# Candados, sin esperar (flock -n), que quedan tomados hasta que termina el script:
#  - el de Inversiones (descriptor 8): un solo despliegue, pausa o reanudación a la vez;
#  - el común con PI (descriptor 9, INV_CANDADO_COMUN_PROD): si está tomado, PI está desplegando.
# El orden es siempre propio → común, para no cruzarse.
tomar_candado_propio() {
  local propio
  propio="$(ruta_escribible "$INV_RAIZ/run/despliegue-inv-008.lock")"
  mkdir -p "$(dirname "$propio")"
  exec 8>"$propio"
  flock -n 8 || morir "otro despliegue, pausa o reanudación de Inversiones está en curso ($propio)"
}

tomar_candado_comun() {
  local comun
  comun="$(ruta_escribible "$INV_CANDADO_COMUN")"
  mkdir -p "$(dirname "$comun")"
  exec 9>"$comun"
  flock -n 9 || morir "PI desplegando: el candado común $comun está tomado. Reintente cuando termine."
}

# Aborta si Inversiones está en pausa (la marca <raíz>/estado/pausado). Se llama DESPUÉS de
# tomar el candado propio, para que nadie ponga o quite la marca entre la lectura y la acción.
negarse_si_pausado() {
  [ ! -e "$INV_MARCA_PAUSA" ] || morir "Inversiones está en pausa ($INV_MARCA_PAUSA): reanude antes con scripts/reanudar-008.sh"
}

# Suma de oom_kill JERÁRQUICO bajo el cgroup de los contenedores ($1 = raíz del cgroup v2): sirve aunque
# el scope del contenedor muerto ya no exista. Driver systemd (system.slice) y cgroupfs (docker).
oom_total() {
  local raiz="$1" total=0 hay=0 archivo n
  for archivo in "$raiz/system.slice/memory.events" "$raiz/docker/memory.events"; do
    [ -r "$archivo" ] || continue
    n="$(awk '$1 == "oom_kill" { print $2; exit }' "$archivo")"
    case "$n" in '' | *[!0-9]*) continue ;; esac
    total=$((total + n))
    hay=1
  done
  [ "$hay" = 1 ] || return 1
  printf '%s\n' "$total"
}

# Raíz del cgroup del host: /sys/fs/cgroup en producción; otra solo con el proyecto de prueba.
raiz_cgroup() {
  if [ -n "${INV_CGROUP:-}" ]; then
    [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PRUEBA" ] || morir "INV_CGROUP solo se acepta con el proyecto $INV_PROYECTO_PRUEBA"
    printf '%s' "$INV_CGROUP"
  else
    printf '%s' /sys/fs/cgroup
  fi
}

# Límites de memoria de los contenedores de 008: mem_limit = memswap_limit, el invariante acordado con PI. Cada noche un
# `daemon-reload` de systemd que dispara una tarea del host deja memory.swap.max en max en el cgroup de todo contenedor
# que esté corriendo, mientras docker inspect sigue diciendo Memory = MemorySwap: el tope deja de ser real sin que Docker
# lo vea. Los contenedores creados después del reload quedan bien. La causa y la solución de fondo (en el host, la decide
# PI): produccion.md §5. Mientras tanto, reaplicar_limites los vuelve a poner sin reiniciar.

# Los datos que deciden los límites del contenedor $1, en una línea «proyecto|nombre|memory|memoryswap|id»: la etiqueta
# del proyecto de Compose, el nombre, HostConfig.Memory y HostConfig.MemorySwap (lo declarado) y el id largo.
datos_limites() {
  docker inspect --type container -f '{{index .Config.Labels "com.docker.compose.project"}}|{{.Name}}|{{.HostConfig.Memory}}|{{.HostConfig.MemorySwap}}|{{.Id}}' "$1"
}

# La carpeta del cgroup v2 del contenedor de id largo $1 (64 hex) bajo la raíz $2: el scope del driver systemd (el del
# VPS) o la carpeta del driver cgroupfs. La primera con memory.swap.max y memory.max legibles; si no hay, falla.
cgroup_de_contenedor() {
  local dir
  [[ "$1" =~ ^[0-9a-f]{64}$ ]] || return 1
  for dir in "$2/system.slice/docker-$1.scope" "$2/docker/$1"; do
    [ -r "$dir/memory.swap.max" ] && [ -r "$dir/memory.max" ] || continue
    printf '%s' "$dir"
    return 0
  done
  return 1
}

# El valor de un archivo del cgroup ($1) sin espacios, o «ilegible». memory.max sale en páginas enteras: los límites del
# compose van en MiB, así que coincide con HostConfig.Memory.
valor_cgroup() {
  local valor
  valor="$( { tr -d '[:space:]' <"$1"; } 2>/dev/null)" || valor=""
  printf '%s' "${valor:-ilegible}"
}

# $1 sin nada fuera de [A-Za-z0-9_.-] (nombres y etiquetas de Docker, que van al log).
limpio() {
  printf '%s' "$1" | LC_ALL=C tr -cd 'A-Za-z0-9_.-'
}

# Por qué reponer el tope a un contenedor (carpeta del cgroup $1, límite $2 en bytes) podría matarlo por OOM, o nada.
# Poner memory.swap.max en 0 no saca lo que ya está en swap: vuelve a la memoria al usarse, y lo que no se puede soltar
# sin swap (anon y shmem de memory.stat; shmem son los shared_buffers de PostgreSQL) más lo que está en swap tiene que
# caber en el límite. Sin nada en swap no hay riesgo; con swap y sin memory.stat legible, no se sabe: cuenta como riesgo.
# La memoria del kernel no se suma (es una cota por abajo).
riesgo_oom() {
  local en_swap anon shmem total
  en_swap="$(valor_cgroup "$1/memory.swap.current")"
  [[ "$en_swap" =~ ^[0-9]+$ ]] || { echo "no deja leer memory.swap.current: no se sabe cuánto tiene en swap"; return 0; }
  [ "$en_swap" != 0 ] || return 0
  anon="$( { awk '$1 == "anon" { print $2; exit }' "$1/memory.stat"; } 2>/dev/null)" || anon=""
  shmem="$( { awk '$1 == "shmem" { print $2; exit }' "$1/memory.stat"; } 2>/dev/null)" || shmem=""
  [[ "$anon" =~ ^[0-9]+$ && "$shmem" =~ ^[0-9]+$ ]] ||
    { echo "tiene $en_swap bytes en swap y no deja leer memory.stat: no se sabe si cabe en su límite"; return 0; }
  total=$((anon + shmem + en_swap))
  [ "$total" -le "$2" ] || echo "tiene $en_swap bytes en swap y no cabría en su límite: anon $anon + shmem $shmem + swap $en_swap = $total > $2"
}

# Fase 1 de reaplicar_limites: solo lee. Deja en LIMITES_PENDIENTES («cid|nombre|mem|swap.max|memory.max|MemorySwap|
# carpeta del cgroup») los contenedores que corren y están fuera de lo declarado: memory.swap.max distinto de 0,
# memory.max distinto de HostConfig.Memory o MemorySwap distinto de Memory. Aborta sin tocar ninguno si `ps` falla, si un
# contenedor no lleva la etiqueta del proyecto activo, si no tiene un límite declarado (no se inventa uno) o, en
# producción, si su cgroup no se puede leer. También si a uno pendiente no le cabría en su límite lo que tiene en swap
# (riesgo_oom). En el proyecto de prueba (en el Mac el cgroup está en la máquina virtual de Colima) un cgroup ilegible solo
# se avisa y se mira HostConfig.
revisar_limites() {
  local raiz ids cid datos proyecto nombre mem swap largo dir swap_max mem_max riesgo
  LIMITES_PENDIENTES=()
  LIMITES_REVISADOS=0
  raiz="$(raiz_cgroup)"
  ids="$("${COMPOSE[@]}" ps -q)" || morir "no se pudieron listar los contenedores de $INV_PROYECTO_ACTIVO (compose ps): los límites no se revisan a ciegas"
  while IFS= read -r cid; do
    [ -n "$cid" ] || continue
    datos="$(datos_limites "$cid")" || morir "no se pudo leer el contenedor $(limpio "$cid") (inspect): no se toca ninguno"
    IFS='|' read -r proyecto nombre mem swap largo <<<"$datos"
    nombre="$(limpio "${nombre#/}")"
    [ "$proyecto" = "$INV_PROYECTO_ACTIVO" ] ||
      morir "el contenedor ${nombre:-$(limpio "$cid")} no lleva la etiqueta del proyecto $INV_PROYECTO_ACTIVO (lleva «$(limpio "$proyecto")»): no se toca ningún contenedor"
    [[ "$mem" =~ ^[1-9][0-9]*$ ]] ||
      morir "el contenedor $nombre no tiene un límite de memoria declarado (HostConfig.Memory = $(limpio "$mem")): no se inventa uno; no se toca ningún contenedor"
    if dir="$(cgroup_de_contenedor "$largo" "$raiz")"; then
      swap_max="$(valor_cgroup "$dir/memory.swap.max")"
      mem_max="$(valor_cgroup "$dir/memory.max")"
    else
      # En producción falla cerrado: sin memory.swap.max no hay cómo saber (ni poner) el tope de swap del contenedor.
      [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PRUEBA" ] ||
        morir "no se pudo leer el cgroup de $nombre (memory.swap.max y memory.max bajo $raiz): no se sabe si usa swap; no se toca ningún contenedor. Si se estaba reiniciando, reintente; si persiste, ver produccion.md §5"
      informar "⚠️  sin el cgroup de $nombre bajo $raiz (proyecto de prueba): solo se revisa HostConfig"
      dir="" swap_max=0 mem_max="$mem"
    fi
    LIMITES_REVISADOS=$((LIMITES_REVISADOS + 1))
    [ "$swap_max" = 0 ] && [ "$mem_max" = "$mem" ] && [ "$swap" = "$mem" ] && continue
    riesgo=""
    [ -z "$dir" ] || riesgo="$(riesgo_oom "$dir" "$mem")"
    [ -z "$riesgo" ] ||
      morir "no se reaplican los límites: $nombre $riesgo. Con el tope repuesto podría morir por OOM al traer de vuelta lo que tiene en swap. No se toca ningún contenedor; lo decide una persona (produccion.md §5)"
    LIMITES_PENDIENTES+=("$cid|$nombre|$mem|$(limpio "$swap_max")|$(limpio "$mem_max")|$(limpio "$swap")|$dir")
  done <<<"$ids"
}

# Fase 2: a cada contenedor de LIMITES_PENDIENTES, `docker update --memory M --memory-swap M` con M = su HostConfig.Memory
# (nunca otro valor), sin reiniciar nada; después relee HostConfig y el cgroup. Si el update falla o algo sigue fuera de
# lo declarado, aborta. Una línea de log por corrección: el contenedor y de qué a qué (y lo que tenía en swap).
corregir_limites() {
  local pendiente cid nombre mem swap_max mem_max swap dir datos ahora_mem ahora_swap ahora_swap_max ahora_mem_max en_swap
  for pendiente in ${LIMITES_PENDIENTES[@]+"${LIMITES_PENDIENTES[@]}"}; do
    IFS='|' read -r cid nombre mem swap_max mem_max swap dir <<<"$pendiente"
    docker update --memory "$mem" --memory-swap "$mem" "$cid" >/dev/null ||
      morir "no se pudieron reaplicar los límites de $nombre (falló «docker update»): no se sigue"
    datos="$(datos_limites "$cid")" || morir "no se pudo releer $nombre después de reaplicar sus límites: no se sigue"
    IFS='|' read -r _ _ ahora_mem ahora_swap _ <<<"$datos"
    ahora_swap_max=0 ahora_mem_max="$mem" en_swap=""
    if [ -n "$dir" ]; then
      ahora_swap_max="$(valor_cgroup "$dir/memory.swap.max")"
      ahora_mem_max="$(valor_cgroup "$dir/memory.max")"
      [ ! -r "$dir/memory.swap.current" ] || en_swap="; en swap: $(limpio "$(valor_cgroup "$dir/memory.swap.current")") bytes"
    fi
    [ "$ahora_swap_max" = 0 ] && [ "$ahora_mem_max" = "$mem" ] && [ "$ahora_mem" = "$mem" ] && [ "$ahora_swap" = "$mem" ] ||
      morir "$nombre sigue mal después de reaplicar sus límites (memory.swap.max = $(limpio "$ahora_swap_max"), memory.max = $(limpio "$ahora_mem_max"), Memory/MemorySwap = $(limpio "$ahora_mem")/$(limpio "$ahora_swap"); declarado $mem): no se sigue"
    informar "límites reaplicados a $nombre: memory.swap.max $swap_max → 0, memory.max $mem_max → $mem, MemorySwap $swap → $mem (HostConfig.Memory = $mem$en_swap)"
  done
}

# Reaplica mem = memswap a los contenedores de 008 que corren ("${COMPOSE[@]}" ps -q, y solo los de la etiqueta del
# proyecto activo), sin reiniciar nada: primero lee y valida todos, después corrige. Se llama directo, nunca dentro de `||`
# ni de una tubería: sus `morir` tienen que cortar el script.
reaplicar_limites() {
  revisar_limites
  corregir_limites
  informar "límites de memoria: $LIMITES_REVISADOS contenedor(es) de $INV_PROYECTO_ACTIVO revisados, ${#LIMITES_PENDIENTES[@]} corregido(s) (mem = memswap)"
}

# Aborta si PI está desplegando o construyendo. $1 dice en qué momento se revisó.
revisar_pi() {
  if [ "$(ps -eo args= | hay_despliegue_ajeno)" = "OCUPADO" ]; then
    morir "PI (u otro proyecto) está desplegando o construyendo ($1): Inversiones no se toca ahora. Reintente cuando termine."
  fi
}

# kB de un campo de /proc/meminfo ($1 = MemAvailable, SwapFree…) en el archivo $2.
leer_meminfo_kb() {
  local valor
  valor="$(awk -v c="$1:" '$1 == c { print $2; exit }' "$2" 2>/dev/null)" || true
  case "$valor" in
    '' | *[!0-9]*) return 1 ;;
  esac
  printf '%s' "$valor"
}

# Archivo meminfo: /proc/meminfo en producción; uno falso solo con el proyecto de prueba.
archivo_meminfo() {
  if [ -n "${INV_MEMINFO:-}" ]; then
    [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PRUEBA" ] || morir "INV_MEMINFO solo se acepta con el proyecto $INV_PROYECTO_PRUEBA"
    printf '%s' "$INV_MEMINFO"
  else
    printf '%s' /proc/meminfo
  fi
}

# sha256 de un archivo, en Linux (sha256sum) o en macOS (shasum).
sha256_de() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}
