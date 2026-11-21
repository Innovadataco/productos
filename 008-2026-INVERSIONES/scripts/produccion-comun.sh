# shellcheck shell=bash
# Inversiones · funciones comunes de los scripts de producción. Se carga con `source`; no se ejecuta.
#
# Candados (orden de Jelk: «no tocar gesmovil ni pi, solo inversiones, ojo no puede dañar nada»):
#  - Docker solo con el proyecto inv-008-prod (o inv-008-prueba en local), siempre por la variable COMPOSE.
#  - Toda escritura en disco, bajo /opt/inversiones-008/ (resuelta físicamente, sin «..» ni enlaces que salgan).
#    Solo dos excepciones, acordadas con el CEO de PI: el candado común /var/lock/despliegue-vps.lock (ese
#    archivo) y los respaldos cifrados en /var/backups/idc/inversiones/ (esa carpeta, sin subcarpetas).
#  - El modo de prueba (inv-008-prueba) solo corre en el Mac o en el CI, nunca donde exista /opt/inversiones-008.
#  - El archivo de producción se lee línea por línea, nunca con `source` (no se ejecuta lo que traiga).

INV_PROYECTO_PROD="inv-008-prod"
INV_PROYECTO_PRUEBA="inv-008-prueba"
INV_RAIZ_PROD="/opt/inversiones-008"
INV_REPO_GITHUB="Innovadataco/productos"
INV_CANDADO_COMUN_PROD="/var/lock/despliegue-vps.lock"
INV_RESPALDOS_PROD="/var/backups/idc/inversiones"
# Criterio de corte de convivencia con PI: MemAvailable en reposo bajo 1 GiB.
UMBRAL_CORTE_KB=1048576
INV_DIR_008="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

morir() {
  printf '❌ [%s] %s\n' "${INV_SCRIPT:-inversiones}" "$*" >&2
  exit 1
}

informar() {
  printf '[%s] %s\n' "${INV_SCRIPT:-inversiones}" "$*" >&2
}

# Fija el proyecto y la raíz de escritura. En producción la raíz es /opt/inversiones-008 y no se puede
# cambiar; INV_BASE e INV_COMPOSE_OVERRIDE solo valen con el proyecto de prueba (en el Mac).
preparar_entorno() {
  INV_PROYECTO_ACTIVO="${INV_PROYECTO:-$INV_PROYECTO_PROD}"
  case "$INV_PROYECTO_ACTIVO" in
    "$INV_PROYECTO_PROD")
      if [ -n "${INV_BASE:-}" ] && [ "$INV_BASE" != "$INV_RAIZ_PROD" ]; then
        morir "INV_BASE solo se acepta con el proyecto $INV_PROYECTO_PRUEBA"
      fi
      [ -z "${INV_COMPOSE_OVERRIDE:-}" ] || morir "INV_COMPOSE_OVERRIDE solo se acepta con el proyecto $INV_PROYECTO_PRUEBA"
      INV_RAIZ="$INV_RAIZ_PROD"
      ;;
    "$INV_PROYECTO_PRUEBA")
      modo_prueba_permitido "$INV_RAIZ_PROD" "$(uname -s)" "${GITHUB_ACTIONS:-}" ||
        morir "el proyecto $INV_PROYECTO_PRUEBA solo corre en el Mac o en el CI, y nunca donde exista $INV_RAIZ_PROD"
      [ -n "${INV_BASE:-}" ] || morir "con $INV_PROYECTO_PRUEBA hay que definir INV_BASE (carpeta de prueba)"
      INV_RAIZ="$INV_BASE"
      ;;
    *)
      morir "proyecto no permitido: «$INV_PROYECTO_ACTIVO». Solo $INV_PROYECTO_PROD (o $INV_PROYECTO_PRUEBA en local); nunca inv-008, el de desarrollo"
      ;;
  esac
  INV_ENV_PROD="$INV_RAIZ/.env.inversiones.production"
  INV_MARCA_PAUSA="$INV_RAIZ/estado/pausado"
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    INV_CANDADO_COMUN="$INV_CANDADO_COMUN_PROD"
  else
    INV_CANDADO_COMUN="$INV_RAIZ/var-lock/despliegue-vps.lock"
  fi
  INV_ESTADO_DIR="$INV_RAIZ/estado"
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    INV_RESPALDOS_DIR="$INV_RESPALDOS_PROD"
  else
    INV_RESPALDOS_DIR="$INV_RAIZ/respaldos"
  fi
}

# Imprime, una por línea, las rutas de las que depende lo que corre con sudo y que alguien distinto de $1
# podría cambiar: de otro dueño, con escritura del grupo o de otros, o enlaces simbólicos. Sin salida = sano.
#  - los padres de la carpeta 008 ($3), sin recursión, hasta $2 (en producción, /): quien escribe en un padre
#    puede cambiar la carpeta entera;
#  - scripts/ (recursivo) y el compose: es lo que corre y lo que decide qué contenedores corren;
#  - .git, .git/config y .git/hooks del clon: `git status` como root puede correr core.fsmonitor o el hook
#    post-index-change;
#  - el archivo de producción ($4): además, sin lectura del grupo ni de otros (600).
# Solo -perm -NNNN y -user: igual en el find de GNU (VPS) y en el de BSD (Mac).
rutas_inseguras() {
  local dueno="$1" tope="$2" dir008="$3" archivo_prod="$4" repo ruta
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
  malas="$(rutas_inseguras root / "$INV_DIR_008" "$INV_ENV_PROD")"
  [ -n "$malas" ] || return 0
  malas="$(printf '%s\n' "$malas" | tr '\n' ' ')"
  if [ "${1:-}" = "--solo-avisar" ]; then
    informar "⚠️  rutas que no son solo de root (otro dueño, escritura del grupo u otros, enlaces, o el archivo de producción sin 600): ${malas}· se sigue: la pausa no se frena"
    return 0
  fi
  morir "rutas que no son solo de root (otro dueño, escritura del grupo u otros, enlaces, o el archivo de producción sin 600): ${malas}· no se corre con sudo"
}

# Arma COMPOSE (arreglo): el proyecto, el compose de este clon y el archivo de producción SOLO para
# interpolar (ningún servicio usa env_file). Es la única forma en que los scripts hablan con Compose.
armar_compose() {
  [ -r "$INV_ENV_PROD" ] || morir "no se puede leer $INV_ENV_PROD (es 600 de root: corra con sudo)"
  COMPOSE=(docker compose -p "$INV_PROYECTO_ACTIVO" -f "$INV_DIR_008/docker-compose.prod.yml")
  if [ -n "${INV_COMPOSE_OVERRIDE:-}" ]; then
    COMPOSE+=(-f "$INV_COMPOSE_OVERRIDE")
  fi
  COMPOSE+=(--env-file "$INV_ENV_PROD")
}

# El modo de prueba se acepta solo si no existe la raíz de producción ($1) y el sistema ($2) es Darwin,
# o Linux dentro de GitHub Actions ($3 = true). En el VPS, /opt/inversiones-008 existe: siempre se rechaza.
modo_prueba_permitido() {
  [ ! -e "$1" ] || return 1
  [ "$2" = "Darwin" ] || { [ "$2" = "Linux" ] && [ "$3" = "true" ]; }
}

# Imprime la ruta física de $1 si queda bajo INV_RAIZ; si no, aborta. La ruta puede no existir todavía.
# Rechaza rutas relativas, componentes «.» o «..», y cualquier enlace simbólico en el camino.
# En producción hay solo dos excepciones, y ninguna puede ser un enlace simbólico:
#  - exactamente el candado común con PI (/var/lock/despliegue-vps.lock);
#  - la carpeta de respaldos /var/backups/idc/inversiones o un archivo directo dentro de ella.
ruta_escribible() {
  local ruta="${1%/}" raiz existente resto="" fisica
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    if [ "$ruta" = "$INV_CANDADO_COMUN_PROD" ]; then
      [ ! -L "$ruta" ] || morir "el candado común es un enlace simbólico: $ruta"
      printf '%s\n' "$ruta"
      return 0
    fi
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
#  - el común con PI (descriptor 9, /var/lock/despliegue-vps.lock): si está tomado, PI está desplegando.
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

# Aborta si Inversiones está en pausa (la marca /opt/inversiones-008/estado/pausado). Se llama DESPUÉS de
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
