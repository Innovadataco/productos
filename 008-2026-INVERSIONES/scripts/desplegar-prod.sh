#!/usr/bin/env bash
# Inversiones · despliegue en el VPS de producción compartido con PI. Mismo patrón que el deploy-prod.sh
# de PI: candado, guarda de disco, migraciones ANTES de servir (contenedor de un solo uso), healthcheck y
# «DEPLOY VERIFICADO <sha>» como ÚLTIMA línea solo si todo pasó. Las imágenes se construyen en el Mac.
#
# Uso (en el VPS, con sudo, desde el clon <raíz>/repo puesto en el sha; <raíz>: ver ESTADO en la gestión):
#   sudo scripts/desplegar-prod.sh <id-imagen | inv-008-app:<sha>> [--cargar <archivo.tar> <sha256>]
#   sudo scripts/desplegar-prod.sh inv-008-app:<sha> --sin-migrar     (reversa a la imagen actual o anterior;
#                                                                     no consulta GitHub)
# La reversa corre con el compose del clon: el sha que corre (estado/sha-actual) o uno posterior, si un despliegue
# falló; el clon no se mueve y solo la imagen vuelve atrás. Así nunca se cruza a una topología vieja
# (produccion.md §5). Despliegue normal: el clon en el sha de la imagen.
#
# Orden: marca de pausa → candados (Inversiones y común con PI) → disco → PI sin desplegar → (.tar:
# etiquetas, sha256 y disco; docker load) → las tres imágenes del mismo sha, amd64 → CI en verde y sha en
# main → clon en el sha, limpio y de root → solo hacia adelante → espera de la medición (120 s si es solo código;
# 600 s si cambian los servicios, los límites o la imagen base, o si no se sabe) → límites reaplicados a lo que corre
# (mem = memswap, sin reiniciar; si no se puede, aborta sin tocar nada más) → medición → (redes de una versión
# anterior: down sin -v) → base y respaldo → roles → PI otra vez → (si migra) app vieja detenida → respaldo cifrado →
# (si migra) respaldo diario detenido → migrador (migraciones, guardián del esquema y privilegios) → app,
# entrada, vigía, respaldo, IA y precios → imagen, salud por la entrada, la app y la base sin puertos y solo en redes
# internal con la puerta de enlace aislada; el servicio de IA healthy, sin puertos y con su entorno → la app sin salida
# a internet (con control positivo desde la entrada) → la salida del servicio de IA (avisa; aborta si se exige) →
# límites reaplicados otra vez y mem = memswap → la espera y la medición (en la corta, piso de memoria: bajo él, se
# extiende a 600 s) → salud otra vez → estado → retención (solo en producción) → convivencia y piso →
# DEPLOY VERIFICADO <sha>. Si algo falla
# después de tocar contenedores, vuelve a la imagen que corría.
# Mientras migra no corre nada de Inversiones que retenga tablas: la app queda abajo desde el respaldo previo
# hasta que el up de la versión nueva queda healthy.
set -euo pipefail
INV_SCRIPT=desplegar-prod
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

MIN_DISCO_GB_POR_DEFECTO=15
# La espera entre el up y la medición de memoria (acuerdo con el CEO de PI): la corta si el despliegue es solo de
# código; la completa si cambian los servicios, los límites o la imagen base, o si no se puede saber.
ESPERA_CORTA_S=120
ESPERA_COMPLETA_S=600
# El piso de la espera corta: MemAvailable bajo UMBRAL_CORTE_KB (1 GiB, el criterio de corte) o SwapFree bajo
# 512 MiB, el mismo par del preflight de memoria de PI (convivencia-pi.md §1).
PISO_SWAPFREE_KB=524288
PERMANENTES=(inv-008-app inv-008-entrada inv-008-vigia inv-008-respaldo inv-008-ia)
# El servicio de IA (E6, D-026) es un permanente más: con una imagen anterior a él queda en espera (lo resuelve su
# entrypoint en el compose), así que no necesita el trato del de precios (--scale 0).
IA="inv-008-ia"
# El puente de su red con salida: nombre fijo para la regla de firewall del host que pone PI.
PUENTE_IA="br-inv008-ia"
# Lo único que el servicio de IA recibe del compose, además del ENV de la imagen: lista blanca de NOMBRES.
PROPIAS_IA=(DATABASE_URL INV_IA_SERVICIO_TOKEN INV_IA_DIR_COMPARTIDA TZ)
# El servicio de precios (D-018) entra con los permanentes solo si la imagen lo trae (imagen_con_servicio_precios).
PRECIOS="inv-008-precios"
# El puente de su red con salida: nombre fijo para la regla de firewall del host que pone PI.
PUENTE_PRECIOS="br-inv008-prec"
# Lo único que el servicio de precios recibe del compose, además del ENV de la imagen: lista blanca de NOMBRES.
PROPIAS_PRECIOS=(DATABASE_URL TZ)
# La sonda de la prueba de no salida: el único destino de internet de 008 en producción (el vigía, Telegram). Lo
# resuelve y lo alcanza la ENTRADA (control positivo); desde la app no debe haber ruta.
SONDA_SALIDA_DESTINO="api.telegram.org"
SONDA_SALIDA_PUERTO=443
# Las redes internal del compose, que van con la puerta de enlace aislada (gateway_mode_ipv4: isolated).
REDES_AISLADAS=(inv-008-red-interna inv-008-red-entrada)
# El control positivo depende de un tercero (el DNS y la sonda): se reintenta antes de dar el despliegue por caído.
INTENTOS_CONTROL=3
PAUSA_CONTROL_S=2
# inv_app tiene CONNECTION LIMIT 10 (crear-roles-prod.sql): el pool de la app deja margen para una sesión a mano.
TOPE_POOL_APP=8

# «ABORTAR» si los GB libres ($1) están bajo el umbral ($2); «SEGUIR» si no (el umbral es el mínimo).
decidir_disco() {
  if [ "$1" -lt "$2" ]; then echo ABORTAR; else echo SEGUIR; fi
}

# Lee por stdin la respuesta de check-runs de GitHub. «VERDE» si inv-gate y app-008 (el último de cada
# uno) terminaron en success; «ROJO» en cualquier otro caso, también si la respuesta no es JSON.
evaluar_ci() {
  local resultado
  resultado="$(jq -r '
    def ultimo($n): [.check_runs[] | select(.name == $n)] | sort_by(.completed_at // "") | last | .conclusion // "ausente";
    if (ultimo("inv-gate") == "success" and ultimo("app-008") == "success") then "VERDE" else "ROJO" end' 2>/dev/null)" || resultado=ROJO
  [ "$resultado" = "VERDE" ] && echo VERDE || echo ROJO
}

# Verdadero solo si `docker port <entrada> 5008` publica únicamente 127.0.0.1:5008 (nunca 0.0.0.0 ni [::]).
puerto_publicado_ok() {
  [ "$1" = "127.0.0.1:5008" ]
}

# Lee la salida de un `nslookup` de busybox por stdin e imprime la primera IPv4 de la RESPUESTA (las líneas
# Address después de «Name:»; nunca la del servidor DNS, que va antes). Sin respuesta, no imprime nada y falla.
ipv4_de_nslookup() {
  awk '
    /^Name:/ { respuesta = 1; next }
    respuesta && /^Address/ {
      for (i = 2; i <= NF; i++) if (ip == "" && $i ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) ip = $i
    }
    END { if (ip == "") exit 1; print ip }'
}

# Verdadero solo si el mensaje de un connect fallido dice que NO HAY RUTA. Un tiempo agotado es ambiguo (podría
# haber ruta y un filtro), y un rechazo («Connection refused») prueba que sí hay ruta.
falla_sin_ruta() {
  case "$1" in
    *"Network unreachable"* | *"No route to host"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Verdadero solo si la respuesta de /api/salud ($1) dice estado ok y la versión es exactamente $2.
salud_ok() {
  local estado version
  estado="$(printf '%s' "$1" | jq -r '.estado // empty' 2>/dev/null)" || return 1
  version="$(printf '%s' "$1" | jq -r '.version // empty' 2>/dev/null)" || return 1
  [ "$estado" = "ok" ] && [ "$version" = "$2" ]
}

# Lee referencias «repo:etiqueta» por stdin e imprime las de Inversiones que se pueden borrar: solo
# inv-008-(app|migrador|vigia):<sha>, y nunca las del sha actual ($1) ni del anterior ($2).
imagenes_a_purgar() {
  local ref sha
  while IFS= read -r ref; do
    [[ "$ref" =~ ^inv-008-(app|migrador|vigia):([0-9a-f]{40})$ ]] || continue
    sha="${BASH_REMATCH[2]}"
    [ "$sha" = "$1" ] || [ "$sha" = "${2:-}" ] || printf '%s\n' "$ref"
  done | sort -u
}

# Lee por stdin las etiquetas del manifest.json del .tar. Verdadero solo si son exactamente las tres
# imágenes de Inversiones del sha $1 (nada ajeno, nada de otro sha).
etiquetas_del_tar_ok() {
  local esperado actual
  esperado="$(printf '%s\n' "inv-008-app:$1" "inv-008-migrador:$1" "inv-008-vigia:$1" | sort)"
  actual="$(grep -v '^$' | sort -u)"
  [ "$actual" = "$esperado" ]
}

# Verdadero si la URL de la app ($1) fija el pool de Prisma: un único connection_limit, entero de 1 a
# TOPE_POOL_APP. Sin él, Prisma abre núcleos × 2 + 1 conexiones. No imprime nada (la URL lleva la clave).
pool_app_ok() {
  local consulta n
  case "$1" in *\?*) consulta="${1#*\?}" ;; *) return 1 ;; esac
  n="$(printf '%s\n' "$consulta" | tr '&' '\n' | sed -n 's/^connection_limit=//p')"
  [[ "$n" =~ ^[1-9][0-9]*$ ]] && [ "$n" -le "$TOPE_POOL_APP" ]
}

# Solo avisa (no bloquea): el despliegue sigue. Lee el archivo de producción sin ejecutarlo.
avisar_pool_app() {
  local url
  url="$(leer_variable_env "$INV_ENV_PROD" INV_APP_DATABASE_URL)" || return 0
  case "$url" in
    *connection_limit=*) pool_app_ok "$url" ||
      informar "⚠️  la URL de la app no trae un único connection_limit de 1 a $TOPE_POOL_APP (inv_app admite 10 conexiones): se sigue; corríjalo en el archivo de producción (produccion.md §2)" ;;
    *) informar "⚠️  sin connection_limit en la URL de la app: Prisma abre núcleos × 2 + 1 conexiones (inv_app admite 10). Se sigue; agregue &connection_limit=5 (produccion.md §2)" ;;
  esac
}

normalizar_id() {
  local id="${1#sha256:}"
  [[ "$id" =~ ^[0-9a-f]{64}$ ]] || return 1
  printf 'sha256:%s' "$id"
}

leer_estado() {
  [ -r "$INV_ESTADO_DIR/$1" ] && tr -d '[:space:]' <"$INV_ESTADO_DIR/$1" || true
}

libres_kb() {
  local kb
  kb="$(df -Pk / | awk 'NR == 2 { print $4 }')"
  [[ "$kb" =~ ^[0-9]+$ ]] || morir "no se pudo medir el disco (df): no se despliega a ciegas"
  printf '%s' "$kb"
}

guarda_disco() {
  local extra_kb="${1:-0}" minimo="${INV_MIN_DISCO_GB:-$MIN_DISCO_GB_POR_DEFECTO}" kb
  [[ "$minimo" =~ ^[0-9]+$ ]] || morir "INV_MIN_DISCO_GB debe ser un entero"
  kb="$(libres_kb)"
  if [ "$extra_kb" -gt 0 ]; then
    [ "$kb" -ge $((minimo * 1024 * 1024 + extra_kb)) ] ||
      morir "disco bajo para cargar: $((kb / 1024)) MiB libres < $minimo GB + 2 × el .tar ($((extra_kb / 1024)) MiB)"
    return 0
  fi
  if [ "$(decidir_disco $((kb / 1024 / 1024)) "$minimo")" = "ABORTAR" ]; then
    morir "disco bajo: $((kb / 1024 / 1024)) GB libres < $minimo GB (como la guarda de PI)"
  fi
  informar "disco: $((kb / 1024 / 1024)) GB libres (mínimo $minimo GB)"
}

cargar_tar() {
  local tar="$1" esperado="$2" sha_tar real tamano_kb
  [[ "$esperado" =~ ^[0-9a-f]{64}$ ]] || morir "--cargar necesita el sha256 de 64 hex calculado en el Mac"
  [ -r "$tar" ] || morir "no se puede leer $tar"
  real="$(sha256_de "$tar")"
  [ "$real" = "$esperado" ] || morir "el sha256 del .tar no coincide con el del Mac: $real ≠ $esperado. No se carga."
  sha_tar="$(tar -xOf "$tar" manifest.json 2>/dev/null | jq -r '.[].RepoTags[]? // empty' 2>/dev/null | sed -n 's/^inv-008-app:\([0-9a-f]\{40\}\)$/\1/p' | head -n 1)"
  tar -xOf "$tar" manifest.json 2>/dev/null | jq -r '.[].RepoTags[]? // empty' 2>/dev/null | etiquetas_del_tar_ok "${sha_tar:-ninguno}" ||
    morir "el .tar no trae exactamente inv-008-app, inv-008-migrador e inv-008-vigia del mismo sha: no se carga"
  tamano_kb=$(($(wc -c <"$tar") / 1024 + 1))
  guarda_disco $((2 * tamano_kb))
  informar "sha256 y etiquetas del .tar verificados; docker load"
  docker load -i "$tar"
}

verificar_ci() {
  local sha="$1" api="https://api.github.com/repos/$INV_REPO_GITHUB" checks estado
  checks="$(curl -fsS --max-time 20 -H 'Accept: application/vnd.github+json' "$api/commits/$sha/check-runs?per_page=100&filter=latest")" ||
    morir "no se pudo consultar el CI del sha en GitHub: no se despliega sin verlo en verde"
  [ "$(printf '%s' "$checks" | evaluar_ci)" = "VERDE" ] || morir "el CI del sha $sha no está en verde (inv-gate y app-008 en success)"
  estado="$(curl -fsS --max-time 20 -H 'Accept: application/vnd.github+json' "$api/compare/$sha...main" | jq -r '.status // empty' 2>/dev/null)" ||
    morir "no se pudo comparar el sha con main en GitHub"
  case "$estado" in
    identical | ahead) informar "CI en verde y el sha está en main" ;;
    *) morir "el sha $sha no está en main (GitHub: «${estado:-sin respuesta}»): solo se despliega lo mergeado" ;;
  esac
}

# El clon (su compose y sus scripts) tiene que ser el del sha de la imagen. Única excepción, la reversa
# (--sin-migrar): el clon se queda en el sha QUE CORRE (estado/sha-actual) o más adelante (un despliegue que falló
# dejó el clon en su sha), y la imagen es anterior (su sha es ancestro del clon). Es la misma combinación que ya usa
# la vuelta atrás automática: la imagen vieja con el compose nuevo. Así una reversa nunca vuelve a una topología
# vieja (la entrada huérfana con el puerto dejaba el sitio caído con éxito aparente; produccion.md §5). Qué imagen
# acepta lo decide verificar_sentido: solo la actual o la anterior.
verificar_clon() {
  local sha="$1" sin_migrar="${2:-0}" cabeza corre
  cabeza="$(git -C "$INV_DIR_008" rev-parse HEAD)"
  [ -z "$(git -C "$INV_DIR_008" status --porcelain --untracked-files=no)" ] || morir "el clon tiene cambios sin commit: no se despliega"
  [ "$cabeza" != "$sha" ] || return 0
  corre="$(leer_estado sha-actual)"
  if [ "$sin_migrar" = 1 ] && [[ "$corre" =~ ^[0-9a-f]{40}$ ]] &&
    git -C "$INV_DIR_008" merge-base --is-ancestor "$corre" "$cabeza" 2>/dev/null &&
    git -C "$INV_DIR_008" merge-base --is-ancestor "$sha" "$cabeza" 2>/dev/null; then
    informar "reversa con el compose del clon ($cabeza, desde el sha que corre $corre): solo la imagen vuelve a $sha"
    return 0
  fi
  if [ "$sin_migrar" = 1 ]; then
    morir "reversa: el clon está en $cabeza; debe estar en el sha que corre (${corre:-ninguno}) o más adelante, con la imagen $sha anterior a él. No mueva el clon a un sha viejo para una reversa"
  fi
  morir "el clon está en $cabeza, no en $sha: git -C $(dirname "$INV_DIR_008") fetch && git -C $(dirname "$INV_DIR_008") checkout $sha"
}

verificar_imagenes() {
  local ref="$1" arquitectura_esperada="amd64" imagen
  ID="$(docker image inspect -f '{{.Id}}' "$ref" 2>/dev/null)" || morir "no existe la imagen $ref en este Docker"
  ID="$(normalizar_id "$ID")" || morir "la imagen $ref tiene un ID inesperado"
  SHA="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$ID")"
  [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || morir "la imagen no trae la etiqueta org.opencontainers.image.revision con un sha"
  if [ -n "${INV_ARQUITECTURA:-}" ]; then
    [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PRUEBA" ] || morir "INV_ARQUITECTURA solo se acepta con el proyecto $INV_PROYECTO_PRUEBA"
    arquitectura_esperada="$INV_ARQUITECTURA"
  fi
  for imagen in "$ID" "inv-008-migrador:$SHA" "inv-008-vigia:$SHA"; do
    docker image inspect -f '{{.Id}}' "$imagen" >/dev/null 2>&1 || morir "falta la imagen $imagen (se construyen y envían las tres juntas)"
    [ "$(docker image inspect -f '{{.Architecture}}' "$imagen")" = "$arquitectura_esperada" ] || morir "$imagen no es $arquitectura_esperada (el VPS es x86_64)"
    [ "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$imagen")" = "$SHA" ] ||
      morir "$imagen no es del mismo sha que la app"
  done
  informar "imagen $ID · sha $SHA · migrador y vigía del mismo sha"
}

verificar_sentido() {
  local sin_migrar="$1" actual imagen_actual anterior
  actual="$(leer_estado sha-actual)"
  imagen_actual="$(leer_estado imagen-actual)"
  anterior="$(leer_estado imagen-anterior)"
  if [ "$sin_migrar" = 1 ]; then
    { [ -n "$imagen_actual" ] && [ "$imagen_actual" = "$ID" ]; } || { [ -n "$anterior" ] && [ "$anterior" = "$ID" ]; } ||
      morir "--sin-migrar es solo para volver a la imagen actual o a la anterior (${imagen_actual:-ninguna} / ${anterior:-ninguna})"
    informar "reversa sin migrar (las migraciones son aditivas) y sin consultar GitHub"
  elif [ -n "$actual" ]; then
    git -C "$INV_DIR_008" merge-base --is-ancestor "$actual" "$SHA" 2>/dev/null ||
      morir "el sha $SHA no desciende del que corre ($actual): no se migra hacia atrás. Para volver, use --sin-migrar."
  fi
}

verificar_roles() {
  local n
  n="$("${COMPOSE[@]}" exec -T inv-008-db psql -X -tA -U postgres -d inversiones \
    -c "SELECT count(*) FROM pg_roles WHERE rolname IN ('inv_dueno', 'inv_app')" | tr -d '[:space:]')"
  [ "$n" = "2" ] || morir "faltan los roles inv_dueno e inv_app: corra antes scripts/crear-roles-prod.sh"
}

# Con mem_limit = memswap_limit, HostConfig.Memory debe ser igual a MemorySwap y, si el cgroup lo expone,
# memory.swap.max debe ser 0: si no, el tope de memoria no es real (el VPS tiene swap). Corre justo después de
# reaplicar_limites: lo que el daemon-reload diario del host deja así ya se corrigió (produccion.md §5).
verificar_memswap() {
  local cid mem swap id largo archivo raiz
  raiz="$(raiz_cgroup)"
  while IFS= read -r cid; do
    [ -n "$cid" ] || continue
    read -r mem swap <<<"$(docker inspect -f '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}}' "$cid")"
    [ "${mem:-0}" -gt 0 ] && [ "$mem" = "$swap" ] || morir "el contenedor $cid tiene Memory=$mem y MemorySwap=$swap: el tope de memoria no es real"
    largo="$(docker inspect -f '{{.Id}}' "$cid")"
    for archivo in "$raiz/system.slice/docker-$largo.scope/memory.swap.max" "$raiz/docker/$largo/memory.swap.max"; do
      [ -r "$archivo" ] || continue
      [ "$(cat "$archivo")" = "0" ] || morir "el contenedor $cid puede usar swap (memory.swap.max = $(cat "$archivo"))"
    done
  done < <("${COMPOSE[@]}" ps -q)
  informar "mem = memswap en todos los contenedores de $INV_PROYECTO_ACTIVO"
}

# Resume por stdin un docker-compose en lo que decide los contenedores y su memoria, una línea por dato y ordenado:
# «servicio <nombre>» y «<servicio> <ruta.clave> <valor>» para las claves de imagen, memoria y CPU a cualquier
# profundidad (con la ruta: un límite de deploy no se confunde con una reserva). No cuentan los comentarios ni el
# contenido de los bloques literales (| o >, como el relé de la entrada). Imprime INDETERMINADO si no hay servicios o
# si lo que decide podría venir de otra parte o el resumen no lo lee: alias, fusiones (<<), etiquetas (!reset), mapas
# en línea ({…}), claves entre comillas, include, extends o un límite interpolado (el archivo de producción no está en
# git; en image solo vale ${INV_TAG:-sin-desplegar}). Awk POSIX (mawk en el VPS): sin anclas dentro de grupos ni \t
# entre corchetes; los tabuladores se pasan a espacios.
resumen_compose() {
  awk '
    function sangria(s) { match(s, /^ */); return RLENGTH }
    BEGIN { bloque = -1; nivel = -1 }
    {
      linea = $0
      gsub("\t", " ", linea)
      sub("\r$", "", linea)
      if (bloque >= 0) {
        if (linea ~ /^ *$/ || sangria(linea) > bloque) next
        bloque = -1
      }
      if (linea ~ /^ *$/ || linea ~ /^ *#/) next
      sub(/ +#.*$/, "", linea)
      sub(/ +$/, "", linea)
      s = sangria(linea)
      if (linea ~ /^ *- +[|>][-+0-9]*$/ || linea ~ /: +[|>][-+0-9]*$/) bloque = s
      if (linea ~ /^ *(- +)?(<<|include|extends) *:/ || linea ~ /^ *- +[*!{]/ || linea ~ /: +[*!{]/) raro = 1
      if (linea ~ /^ *(- +)?("[^"]*"|\047[^\047]*\047) *:/) raro = 1
      if (s == 0) { en = (linea == "services:"); nivel = -1; servicio = ""; next }
      if (!en) next
      if (nivel < 0) nivel = s
      if (s <= nivel) {
        servicio = linea
        sub(/^ +/, "", servicio)
        sub(/ *:.*$/, "", servicio)
        print "servicio " servicio
        hay = 1
        n = 0
        next
      }
      if (linea !~ /^ *(- +)?[A-Za-z0-9_.-]+ *:/) next
      clave = linea
      sub(/^ *(- +)?/, "", clave)
      valor = clave
      sub(/ *:.*$/, "", clave)
      sub(/^[^:]*: */, "", valor)
      while (n > 0 && pila_s[n] >= s) n--
      ruta = ""
      for (i = 1; i <= n; i++) ruta = ruta pila_k[i] "."
      if (clave ~ /^(image|mem_limit|memswap_limit|mem_reservation|mem_swappiness|memory|shm_size|cpus|cpu_shares|cpu_quota|cpu_period|cpuset|scale|replicas|oom_kill_disable|oom_score_adj)$/) {
        if (valor ~ /\$/ && !(clave == "image" && valor ~ /^inv-008-[a-z]+:\$\{INV_TAG:-sin-desplegar\}$/)) raro = 1
        print servicio " " ruta clave " " valor
      }
      if (valor == "") { n++; pila_s[n] = s; pila_k[n] = clave }
    }
    END { if (raro || !hay) print "INDETERMINADO" }' | LC_ALL=C sort
}

# Resume por stdin un Dockerfile en lo que decide la imagen base: sus FROM en orden y los ARG globales (los de antes
# del primer FROM, los únicos que un FROM puede usar), con sus continuaciones (\) unidas. Lo que continúa otra
# instrucción (un LABEL, un RUN) no cuenta. INDETERMINADO si no hay FROM o si cambia el carácter de escape.
resumen_dockerfile() {
  awk '
    {
      linea = $0
      gsub("\t", " ", linea)
      sub("\r$", "", linea)
      if (sigue) {
        if (toma) actual = actual " " linea
        sigue = (linea ~ /\\$/)
        if (!sigue && toma) { print actual; toma = 0 }
        next
      }
      mayus = toupper(linea)
      if (!instruccion && mayus ~ /^# *ESCAPE *=/) raro = 1
      if (linea ~ /^ *$/ || linea ~ /^ *#/) next
      instruccion = 1
      es_from = (mayus ~ /^ *FROM /)
      if (es_from) hay = 1
      toma = es_from || (!hay && mayus ~ /^ *ARG /)
      sigue = (linea ~ /\\$/)
      if (toma && !sigue) { print linea; toma = 0 }
      else if (toma) actual = linea
    }
    END { if (sigue && toma) print actual; if (raro || !hay) print "INDETERMINADO" }'
}

# Las líneas de stdin ordenadas y sin caracteres de control (van al log).
limpias_ordenadas() {
  LC_ALL=C tr -d '\000-\010\013-\037\177' | LC_ALL=C sort
}

# Las diferencias entre dos resúmenes ($1, lo que corre; $2, lo que va a correr), en una línea y acotadas: seis como
# mucho, de 160 caracteres. Si son las mismas líneas en otro orden (FROM reordenados), lo dice.
diferencias() {
  local texto
  texto="$(LC_ALL=C comm -3 <(printf '%s\n' "$1" | limpias_ordenadas) <(printf '%s\n' "$2" | limpias_ordenadas) |
    LC_ALL=C awk -F '\t' '
      NR <= 6 { printf "%s%s", (NR > 1 ? "; " : ""), ($1 != "" ? "antes «" substr($1, 1, 160) "»" : "ahora «" substr($2, 1, 160) "»") }
      END { if (NR > 6) printf "; y %d más", NR - 6 }')"
  printf '%s' "${texto:-mismas líneas en otro orden}"
}

# El archivo $2 (relativo a la carpeta 008) tal como está en el commit $1 del clon. Corre como root: con cat-file (sin
# textconv, filtros ni diff externos), sin objetos de reemplazo, sin la configuración del sistema ni la del usuario y
# sin las variables GIT_* del entorno (GIT_DIR cambiaría de repositorio).
archivo_en_sha() {
  env -i PATH="$PATH" GIT_CONFIG_NOSYSTEM=1 git --no-replace-objects -C "$INV_DIR_008" cat-file blob "$1:./$2" 2>/dev/null
}

# Imprime por qué la medición necesita la espera completa, o nada si el despliegue es solo de código. Compara sin red,
# solo con el clon, lo que corre ($1, estado/sha-actual) con lo que va a correr: los servicios, límites e imágenes del
# compose del clon (el que usa COMPOSE) y los FROM del Dockerfile del sha de la imagen ($2). En un despliegue normal el
# clon está en el sha de la imagen; en la reversa, en el que corre o más adelante (verificar_clon): la regla es la
# misma. Lo que no se puede leer o comparar da la espera completa.
motivo_espera_completa() {
  local corre="$1" imagen="$2" texto antes despues
  [[ "$corre" =~ ^[0-9a-f]{40}$ ]] || { echo "sin un sha que corre en estado/sha-actual (primer despliegue o estado dañado)"; return 0; }
  [[ "$imagen" =~ ^[0-9a-f]{40}$ ]] || { echo "la imagen no trae un sha de 40 hex"; return 0; }
  texto="$(archivo_en_sha "$corre" docker-compose.prod.yml)" || { echo "no se pudo leer el compose de $corre en el clon"; return 0; }
  antes="$(printf '%s\n' "$texto" | resumen_compose)" && despues="$(resumen_compose <"$INV_DIR_008/docker-compose.prod.yml")" ||
    { echo "no se pudo leer o resumir el compose del clon"; return 0; }
  case "$antes$despues" in
    *INDETERMINADO*) echo "el compose no se puede comparar (sin servicios, o con alias, <<, etiquetas, include, extends o límites interpolados)"; return 0 ;;
  esac
  [ "$antes" = "$despues" ] || { echo "cambian servicios, límites o imágenes del compose respecto de $corre: $(diferencias "$antes" "$despues")"; return 0; }
  antes="$(archivo_en_sha "$corre" Dockerfile)" && despues="$(archivo_en_sha "$imagen" Dockerfile)" ||
    { echo "no se pudo leer el Dockerfile de $corre o de $imagen en el clon"; return 0; }
  antes="$(printf '%s\n' "$antes" | resumen_dockerfile)"
  despues="$(printf '%s\n' "$despues" | resumen_dockerfile)"
  case "$antes$despues" in
    *INDETERMINADO*) echo "el Dockerfile no se puede comparar (sin FROM o con # escape=)"; return 0 ;;
  esac
  [ "$antes" = "$despues" ] || echo "cambia la imagen base (FROM o ARG globales del Dockerfile) respecto de $corre: $(diferencias "$antes" "$despues")"
}

# Fija ESPERA (los segundos entre el up y la medición) e imprime en UNA línea cuál y por qué. $1: INV_ESPERA_MEDICION_S
# ya validado, o vacío; si viene, manda como antes. $2: el sha que corre.
decidir_espera() {
  local explicita="$1" motivo base porque
  motivo="$(motivo_espera_completa "$2" "$SHA" | tr '\n' ' ')"
  motivo="${motivo% }"
  if [ -n "$motivo" ]; then
    base="$ESPERA_COMPLETA_S"
    porque="$motivo"
  else
    base="$ESPERA_CORTA_S"
    porque="solo código: mismos servicios, límites e imágenes del compose y mismos FROM del Dockerfile que el sha que corre ($2)"
  fi
  if [ -n "$explicita" ]; then
    ESPERA="$explicita"
    informar "espera de la medición: $ESPERA s · INV_ESPERA_MEDICION_S explícito (la comparación daba $base s: $porque)"
  else
    ESPERA="$base"
    informar "espera de la medición: $ESPERA s · $porque"
  fi
}

# Por qué la memoria del VPS está bajo el piso de la espera corta (MemAvailable < 1 GiB o SwapFree < 512 MiB), o nada.
# Lee el meminfo como medir-memoria.sh y vigilar-convivencia.sh. Si no lo puede leer, cuenta como bajo el piso: no se
# da por buena una memoria sin medir. Sin swap (SwapFree 0), también: es la regla del acuerdo.
memoria_bajo_piso() {
  local meminfo disponible swap motivo=""
  meminfo="$(archivo_meminfo)" || { echo "no se pudo ubicar el meminfo"; return 0; }
  disponible="$(leer_meminfo_kb MemAvailable "$meminfo")" || { echo "no se pudo leer MemAvailable de $meminfo"; return 0; }
  swap="$(leer_meminfo_kb SwapFree "$meminfo")" || { echo "no se pudo leer SwapFree de $meminfo"; return 0; }
  [ "$disponible" -ge "$UMBRAL_CORTE_KB" ] || motivo="MemAvailable $((disponible / 1024)) MiB < $((UMBRAL_CORTE_KB / 1024)) MiB"
  [ "$swap" -ge "$PISO_SWAPFREE_KB" ] || motivo="${motivo:+$motivo y }SwapFree $((swap / 1024)) MiB < $((PISO_SWAPFREE_KB / 1024)) MiB"
  [ -z "$motivo" ] || printf '%s\n' "$motivo"
}

# La espera después del up y su medición. Si la espera es menor que la completa (la corta, o una explícita) y la memoria
# queda bajo el piso, se extiende hasta completar ESPERA_COMPLETA_S y se mide otra vez. Todo corre dentro de este
# proceso: los candados (descriptores 8 y 9) siguen tomados hasta que sale. Deja en BAJO_PISO el motivo si la memoria
# sigue bajo el piso, o nada.
esperar_y_medir() {
  local espera="$1" medicion="$2" resto
  BAJO_PISO=""
  informar "esperando ${espera}s para la medición después de up"
  sleep "$espera"
  "$INV_DIR_008/scripts/medir-memoria.sh" --etiqueta "$espera s después de up" --salida "$medicion"
  [ "$espera" -lt "$ESPERA_COMPLETA_S" ] || return 0
  BAJO_PISO="$(memoria_bajo_piso)"
  [ -n "$BAJO_PISO" ] || return 0
  resto=$((ESPERA_COMPLETA_S - espera))
  informar "⚠️  memoria bajo el piso a los $espera s ($BAJO_PISO): se extiende la espera $resto s, hasta $ESPERA_COMPLETA_S s, y se mide otra vez. Los candados siguen tomados."
  sleep "$resto"
  "$INV_DIR_008/scripts/medir-memoria.sh" --etiqueta "$ESPERA_COMPLETA_S s después de up (espera extendida)" --salida "$medicion"
  BAJO_PISO="$(memoria_bajo_piso)"
  if [ -n "$BAJO_PISO" ]; then
    informar "⚠️  la memoria sigue bajo el piso a los $ESPERA_COMPLETA_S s ($BAJO_PISO)"
  else
    informar "la memoria volvió sobre el piso a los $ESPERA_COMPLETA_S s: se sigue"
  fi
}

# El contenedor $2 del servicio $1: corriendo DE UNA VEZ (un contenedor que sale o se reinicia es un fallo, no algo
# pasajero: instrumentation.ts hace process.exit(1) sin AUTH_SECRET o sin APP_ORIGEN, y restart: always lo vuelve a
# levantar) y con la imagen enviada. La entrada usa la misma imagen que la app.
verificar_corriendo() {
  local quien="$1" cid="$2" corriendo imagen
  corriendo="$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' "$cid")"
  [ "$corriendo" = "running 0" ] || morir "$quien no quedó corriendo de una vez (estado y reinicios: $corriendo): revise sus logs"
  imagen="$(normalizar_id "$(docker inspect -f '{{.Image}}' "$cid")")" || morir "no se pudo leer la imagen de $quien"
  [ "$imagen" = "$ID" ] || morir "$quien corre $imagen y no la imagen enviada $ID"
}

# Sin puertos y solo en redes internal (sin salida a internet) con la puerta de enlace aislada: cada red del
# contenedor $2, una por una. Del aislamiento se revisa la opción Y su efecto: una red aislada no tiene puerta de
# enlace del host (Docker 29 la muestra como «invalid IP»); si el demonio no aplicó la opción, tendría una dirección.
verificar_aislado() {
  local quien="$1" cid="$2" puertos redes red datos interna modo puerta
  puertos="$(docker port "$cid")"
  [ -z "$puertos" ] || morir "$quien publica puertos ($puertos): debe quedar solo en redes internas"
  redes="$(docker inspect -f '{{range $nombre, $_ := .NetworkSettings.Networks}}{{$nombre}} {{end}}' "$cid")" || morir "no se pudieron leer las redes de $quien"
  [ -n "${redes// /}" ] || morir "$quien no está en ninguna red"
  for red in $redes; do
    datos="$(docker inspect --type network -f '{{.Internal}}|{{index .Options "com.docker.network.bridge.gateway_mode_ipv4"}}|{{range .IPAM.Config}}{{.Gateway}}{{end}}' "$red")" ||
      morir "no se pudo leer la red $red"
    IFS='|' read -r interna modo puerta <<<"$datos"
    [ "$interna" = "true" ] || morir "$quien está en la red $red, que tiene salida a internet (no es internal)"
    [ "$modo" = "isolated" ] || morir "$quien está en la red $red, internal pero sin aislar la puerta de enlace (gateway_mode_ipv4: ${modo:-ninguno}): llegaría al host"
    case "$puerta" in
      '' | 'invalid IP') ;;
      *) morir "$quien está en la red $red, que dice isolated pero tiene puerta de enlace del host ($puerta): el demonio no aplicó el aislamiento" ;;
    esac
  done
}

# ¿La imagen del sha $1 trae el servicio de precios (D-018)? Se mira en el clon, sin contenedores ni red: el commit de la
# imagen (su etiqueta revision es ese sha) trae src/servicio-precios/bucle.ts. 0 sí · 1 no (una imagen anterior al
# servicio: su bundle no tiene el modo «bucle», saldría con 2 en un bucle de reinicios y el --wait fallaría) · 2 no se
# puede saber (el clon no tiene ese commit, o git no pudo leerlo). Igual en reanudar-008.sh (lo cuida desplegar-precios.test.ts).
imagen_con_servicio_precios() {
  local git_clon=(env -i PATH="$PATH" GIT_CONFIG_NOSYSTEM=1 git --no-replace-objects -C "$INV_DIR_008")
  "${git_clon[@]}" cat-file -e "$1^{commit}" 2>/dev/null || return 2
  "${git_clon[@]}" cat-file -e "$1:./src/servicio-precios/bucle.ts" 2>/dev/null || return 1
  return 0
}

# Fija UP_PERMANENTES, la lista del up de los permanentes para la imagen del sha $1: con el servicio de precios si la
# imagen lo trae; si no (o no se sabe), con --scale inv-008-precios=0, que baja el contenedor que haya. $2 = --estricto:
# si no se puede saber, aborta (el despliegue, con el clon en el sha); sin él, sigue sin el servicio (la vuelta atrás).
permanentes_para() {
  local rc=0
  imagen_con_servicio_precios "$1" || rc=$?
  if [ "$rc" = 0 ]; then
    UP_PERMANENTES=("${PERMANENTES[@]}" "$PRECIOS")
    CON_PRECIOS=1
    return 0
  fi
  [ "$rc" = 1 ] || [ "${2:-}" != "--estricto" ] || morir "no se pudo saber si la imagen de $1 trae el servicio de precios (el clon no tiene ese commit, o git no pudo leerlo)"
  UP_PERMANENTES=(--scale "$PRECIOS=0" "${PERMANENTES[@]}" "$PRECIOS")
  CON_PRECIOS=0
}

# El entorno del contenedor $1, una variable por línea. Va SIEMPRE por tubería, nunca a una variable del shell: trae la
# URL con la clave, y un `bash -x` (o SHELLOPTS=xtrace) la imprimiría al expandirla.
entorno_de() {
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1"
}

# Su entorno, por NOMBRES y con lista blanca: el ENV de la imagen enviada más PROPIAS_PRECIOS; cualquier otra (PG*, la
# de otro servicio, una clave) aborta. De su credencial se miran solo el usuario y el host (nunca se imprime ni se
# guarda la URL): inv_precios en inv-008-db, o vacía (sin el secreto: queda en espera).
verificar_entorno_precios() {
  local cid="$1" permitidas ajenas destino
  permitidas="$( { docker image inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$ID" | cut -d= -f1; printf '%s\n' "${PROPIAS_PRECIOS[@]}"; } | LC_ALL=C sort -u)" ||
    morir "no se pudo leer el entorno de la imagen enviada"
  ajenas="$(entorno_de "$cid" | cut -d= -f1 | LC_ALL=C sort -u | LC_ALL=C comm -23 - <(printf '%s\n' "$permitidas") | LC_ALL=C tr -cd '[:alnum:]_\n' | tr '\n' ' ')" ||
    morir "no se pudo leer el entorno del servicio de precios"
  [ -z "${ajenas// /}" ] || morir "el servicio de precios recibe variables que no son suyas: $ajenas"
  if ! entorno_de "$cid" | grep -q '^DATABASE_URL=.'; then
    informar "⚠️  el servicio de precios corre sin INV_PRECIOS_DATABASE_URL: queda en espera y no trae precios (produccion.md §2)"
    return 0
  fi
  destino="$(entorno_de "$cid" | sed -n 's|^DATABASE_URL=postgres\(ql\)\{0,1\}://\([^:@/]*\)\(:[^@/]*\)\{0,1\}@\([^:/?]*\).*|\2@\4|p')"
  [ "$destino" = "inv_precios@inv-008-db" ] || morir "la DATABASE_URL del servicio de precios no es la de inv_precios en inv-008-db"
  informar "el servicio de precios corre con la credencial de inv_precios"
}

# El servicio de precios (D-018): corriendo de una vez con la imagen enviada y healthy (su latido), sin puertos, solo en
# la red interna y en la suya, que tiene salida, el puente PUENTE_PRECIOS y nadie más, y con su entorno.
verificar_precios() {
  local cid redes esperadas red_precios="${INV_PROYECTO_ACTIVO}_inv-008-red-precios" datos
  cid="$("${COMPOSE[@]}" ps -q "$PRECIOS")"
  [ -n "$cid" ] || morir "no hay contenedor del servicio de precios"
  verificar_corriendo "el servicio de precios" "$cid"
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$cid")" = healthy ] || morir "el servicio de precios no está healthy (su latido, /estado/bucle): revise sus logs"
  [ -z "$(docker port "$cid")" ] || morir "el servicio de precios publica puertos"
  redes="$(docker inspect -f '{{range $nombre, $_ := .NetworkSettings.Networks}}{{$nombre}} {{end}}' "$cid")" || morir "no se pudieron leer las redes del servicio de precios"
  esperadas="${INV_PROYECTO_ACTIVO}_inv-008-red-interna $red_precios "
  [ "$redes" = "$esperadas" ] || morir "el servicio de precios está en otras redes ($redes): solo la interna y la suya"
  datos="$(docker inspect --type network -f '{{.Internal}}|{{index .Options "com.docker.network.bridge.name"}}|{{len .Containers}}' "$red_precios")" ||
    morir "no se pudo leer la red $red_precios"
  [ "$datos" = "false|$PUENTE_PRECIOS|1" ] ||
    morir "la red de precios no es la esperada (internal|puente|contenedores: $datos): con salida, el puente $PUENTE_PRECIOS y solo el servicio"
  verificar_entorno_precios "$cid"
  informar "el servicio de precios corre la imagen enviada, healthy, sin puertos, solo en la red interna y la suya ($PUENTE_PRECIOS)"
}

# El entorno del servicio de IA, por NOMBRES y con lista blanca: el ENV de la imagen enviada más PROPIAS_IA; cualquier
# otra (una clave de cifrado, la de otro servicio, la llave de la nube) aborta. De su credencial se miran solo el usuario
# y el host (nunca se imprime ni se guarda la URL): inv_ia en inv-008-db, o vacía. Del token, solo si está.
verificar_entorno_ia() {
  local cid="$1" permitidas ajenas destino
  permitidas="$( { docker image inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$ID" | cut -d= -f1; printf '%s\n' "${PROPIAS_IA[@]}"; } | LC_ALL=C sort -u)" ||
    morir "no se pudo leer el entorno de la imagen enviada"
  ajenas="$(entorno_de "$cid" | cut -d= -f1 | LC_ALL=C sort -u | LC_ALL=C comm -23 - <(printf '%s\n' "$permitidas") | LC_ALL=C tr -cd '[:alnum:]_\n' | tr '\n' ' ')" ||
    morir "no se pudo leer el entorno del servicio de IA"
  [ -z "${ajenas// /}" ] || morir "el servicio de IA recibe variables que no son suyas: $ajenas"
  entorno_de "$cid" | grep -q '^INV_IA_SERVICIO_TOKEN=.' ||
    informar "⚠️  el servicio de IA corre sin INV_IA_SERVICIO_TOKEN: no atiende los pedidos de la app («Identificar» y «Probar» quedan pendientes; produccion.md §2)"
  if ! entorno_de "$cid" | grep -q '^DATABASE_URL=.'; then
    informar "⚠️  el servicio de IA corre sin INV_IA_DATABASE_URL: queda en espera y no hace resúmenes (produccion.md §2)"
    return 0
  fi
  destino="$(entorno_de "$cid" | sed -n 's|^DATABASE_URL=postgres\(ql\)\{0,1\}://\([^:@/]*\)\(:[^@/]*\)\{0,1\}@\([^:/?]*\).*|\2@\4|p')"
  [ "$destino" = "inv_ia@inv-008-db" ] || morir "la DATABASE_URL del servicio de IA no es la de inv_ia en inv-008-db"
  informar "el servicio de IA corre con la credencial de inv_ia"
}

# El servicio de IA (E6): corriendo de una vez con la imagen enviada y healthy (su latido), sin puertos, solo en la red
# interna y en la suya, que tiene salida, el puente PUENTE_IA y nadie más, y con su entorno.
verificar_ia() {
  local cid redes esperadas red_ia="${INV_PROYECTO_ACTIVO}_inv-008-red-ia" datos
  cid="$("${COMPOSE[@]}" ps -q "$IA")"
  [ -n "$cid" ] || morir "no hay contenedor del servicio de IA"
  verificar_corriendo "el servicio de IA" "$cid"
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$cid")" = healthy ] || morir "el servicio de IA no está healthy (su latido, /estado/bucle): revise sus logs"
  [ -z "$(docker port "$cid")" ] || morir "el servicio de IA publica puertos"
  docker exec "$cid" test -r /app/ia/servicio-ia.mjs || morir "la imagen enviada no trae el bundle del servicio de IA (/app/ia/servicio-ia.mjs)"
  redes="$(docker inspect -f '{{range $nombre, $_ := .NetworkSettings.Networks}}{{$nombre}} {{end}}' "$cid")" || morir "no se pudieron leer las redes del servicio de IA"
  esperadas="${INV_PROYECTO_ACTIVO}_inv-008-red-ia ${INV_PROYECTO_ACTIVO}_inv-008-red-interna "
  [ "$redes" = "$esperadas" ] || morir "el servicio de IA está en otras redes ($redes): solo la interna y la suya"
  datos="$(docker inspect --type network -f '{{.Internal}}|{{index .Options "com.docker.network.bridge.name"}}|{{len .Containers}}' "$red_ia")" ||
    morir "no se pudo leer la red $red_ia"
  [ "$datos" = "false|$PUENTE_IA|1" ] ||
    morir "la red del servicio de IA no es la esperada (internal|puente|contenedores: $datos): con salida, el puente $PUENTE_IA y solo el servicio"
  verificar_entorno_ia "$cid"
  informar "el servicio de IA corre la imagen enviada, healthy, sin puertos, solo en la red interna y la suya ($PUENTE_IA)"
}

verificar_servicio() {
  local cid salud
  cid="$("${COMPOSE[@]}" ps -q inv-008-app)"
  [ -n "$cid" ] || morir "no hay contenedor de la app"
  verificar_corriendo "la app" "$cid"
  verificar_aislado "la app" "$cid"
  cid="$("${COMPOSE[@]}" ps -q inv-008-entrada)"
  [ -n "$cid" ] || morir "no hay contenedor de la entrada (el relé del túnel hacia la app)"
  verificar_corriendo "la entrada" "$cid"
  # La salud se pide DENTRO de la entrada: es el camino del túnel (entrada → app), no un atajo a la app.
  salud="$(docker exec "$cid" wget -qO- http://127.0.0.1:5008/api/salud)" || morir "/api/salud no respondió 200 por la entrada"
  salud_ok "$salud" "$SHA" || morir "/api/salud por la entrada no dice ok con la versión $SHA: $(printf '%s' "$salud" | head -c 200)"
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    puerto_publicado_ok "$(docker port "$cid" 5008)" || morir "la entrada no está publicada solo en 127.0.0.1:5008"
    # Lo que ve el túnel: el puerto del host, por la entrada, hasta la app.
    salud="$(curl -fsS --max-time 10 http://127.0.0.1:5008/api/salud)" || morir "/api/salud no respondió 200 en 127.0.0.1:5008 del host"
    salud_ok "$salud" "$SHA" || morir "/api/salud en 127.0.0.1:5008 del host no dice ok con la versión $SHA"
  fi
  cid="$("${COMPOSE[@]}" ps -q inv-008-db)"
  verificar_aislado "la base" "$cid"
  informar "la app corre la imagen enviada, sin puertos y solo en redes internal; /api/salud por la entrada responde ok con la versión $SHA"
  [ "$CON_PRECIOS" = 0 ] || verificar_precios
  verificar_ia
}

# Imprime, una por línea, las redes internal del proyecto que YA existen sin la puerta de enlace aislada (de una
# versión anterior). Sin salida: no existen todavía o están al día.
redes_viejas() {
  local red modo
  for red in "${REDES_AISLADAS[@]}"; do
    modo="$(docker inspect --type network -f '{{index .Options "com.docker.network.bridge.gateway_mode_ipv4"}}' "${INV_PROYECTO_ACTIVO}_$red" 2>/dev/null)" || continue
    [ "$modo" = "isolated" ] || printf '%s\n' "${INV_PROYECTO_ACTIVO}_$red"
  done
}

# Medido en el Mac (Compose 5.3.1): Compose no recrea en su lugar una red internal cuyas driver_opts cambiaron si tiene
# contenedores conectados («container … is not connected to the network»): el up falla y la vuelta atrás también. Por
# eso, si quedan redes de una versión anterior, primero un down SIN -v (los volúmenes quedan); el up las crea nuevas.
bajar_si_redes_viejas() {
  local viejas
  viejas="$(redes_viejas)"
  [ -n "$viejas" ] || return 0
  revisar_pi "antes de bajar para recrear las redes"
  # Desde aquí la vuelta atrás vuelve a levantar todo, aunque el sha sea el mismo.
  DETENIDOS=1
  informar "redes de una versión anterior, sin aislar la puerta de enlace ($(printf '%s' "$viejas" | tr '\n' ' ')): down SIN -v para que el up las cree nuevas; los volúmenes quedan"
  "${COMPOSE[@]}" down || morir "el down para recrear las redes falló: revise a mano (produccion.md §5)"
}

# La IPv4 de la sonda, resuelta DENTRO del contenedor $1 (vacío y falla si no resolvió).
ipv4_resuelta_en() {
  local cid="$1"
  { docker exec "$cid" nslookup -type=a "$SONDA_SALIDA_DESTINO" 2>/dev/null || true; } | ipv4_de_nslookup
}

# Control positivo: el contenedor $1 (la entrada) resuelve la sonda y llega a su IP. Imprime la IP. Se reintenta.
# `nc -z -v`: sin -v, el nc de busybox no dice por qué no conectó (medido en la imagen de la app).
control_positivo() {
  local cid="$1" intento ip
  for ((intento = 1; intento <= INTENTOS_CONTROL; intento++)); do
    if ip="$(ipv4_resuelta_en "$cid")" && docker exec "$cid" nc -z -v -w 5 "$ip" "$SONDA_SALIDA_PUERTO" >/dev/null 2>&1; then
      printf '%s\n' "$ip"
      return 0
    fi
    [ "$intento" = "$INTENTOS_CONTROL" ] || sleep "$PAUSA_CONTROL_S"
  done
  return 1
}

# La app no tiene salida a internet. La sonda la resuelve y la alcanza la ENTRADA (control positivo: sin él, una
# falla de la app no probaría nada); desde la app, la misma IP debe fallar por FALTA DE RUTA (no por tiempo agotado
# ni rechazo) y el nombre no debe resolver (sin DNS externo). Por IP: el resultado no depende del DNS de la app.
verificar_sin_salida() {
  local cid ip salida rc=0
  cid="$("${COMPOSE[@]}" ps -q inv-008-entrada)"
  ip="$(control_positivo "$cid")" ||
    morir "control positivo caído (fuera de Inversiones): en $INTENTOS_CONTROL intentos la entrada no resolvió o no alcanzó $SONDA_SALIDA_DESTINO:$SONDA_SALIDA_PUERTO. Sin él, la no salida de la app no queda probada: el despliegue se detiene; reintente cuando haya red"
  cid="$("${COMPOSE[@]}" ps -q inv-008-app)"
  salida="$(docker exec "$cid" nc -z -v -w 5 "$ip" "$SONDA_SALIDA_PUERTO" 2>&1)" || rc=$?
  [ "$rc" != 0 ] || morir "LA APP TIENE SALIDA A INTERNET: llegó a $SONDA_SALIDA_DESTINO ($ip:$SONDA_SALIDA_PUERTO)"
  falla_sin_ruta "$salida" ||
    morir "la app no llegó a $ip:$SONDA_SALIDA_PUERTO, pero no por falta de ruta («${salida:-sin mensaje}», código $rc): la no salida no queda probada"
  if ipv4_resuelta_en "$cid" >/dev/null; then
    morir "la app resuelve nombres de internet ($SONDA_SALIDA_DESTINO): no debe tener DNS externo"
  fi
  IP_SONDA="$ip"
  informar "la app no tiene salida a internet: sin ruta a $ip:$SONDA_SALIDA_PUERTO ni DNS externo; la entrada sí llega (control positivo)"
}

# El servicio de IA sí tiene una red con salida (su puente, PUENTE_IA): por ella llega al Ollama del Mac, por la tailnet.
# A INTERNET no debe llegar, pero eso no lo corta el compose (una red de Docker no filtra por destino): lo cortan su
# código (solo una IPv4 de la tailnet, src/ia/local/destino.ts) y la regla de firewall del host que pone PI sobre ese
# puente (I-464). Aquí se prueba la red, contra la misma IP pública de la sonda que la entrada acaba de alcanzar
# (IP_SONDA, el control positivo de verificar_sin_salida: nunca una IP escrita en el repo).
# D-026: la IA se activa SIN esperar la regla de PI. Por eso, si el servicio llega a internet se AVISA y el despliegue
# sigue; con INV_IA_EXIGIR_SIN_SALIDA=1 (cuando PI confirme su regla) se aborta, con vuelta atrás.
verificar_salida_ia() {
  local cid salida rc=0
  [ -n "$IP_SONDA" ] || morir "no hay IP de la sonda (verificar_sin_salida va antes): la salida del servicio de IA no se puede probar"
  cid="$("${COMPOSE[@]}" ps -q "$IA")"
  [ -n "$cid" ] || morir "no hay contenedor del servicio de IA"
  salida="$(docker exec "$cid" nc -z -v -w 5 "$IP_SONDA" "$SONDA_SALIDA_PUERTO" 2>&1)" || rc=$?
  if [ "$rc" != 0 ]; then
    informar "el servicio de IA no llega a internet: $IP_SONDA:$SONDA_SALIDA_PUERTO falló («${salida:-sin mensaje}», código $rc); la entrada sí llegó (control positivo)"
    return 0
  fi
  [ "${INV_IA_EXIGIR_SIN_SALIDA:-0}" != 1 ] ||
    morir "EL SERVICIO DE IA TIENE SALIDA A INTERNET: llegó a $SONDA_SALIDA_DESTINO ($IP_SONDA:$SONDA_SALIDA_PUERTO) por su puente $PUENTE_IA. Falta la regla de firewall de PI"
  informar "⚠️  EL SERVICIO DE IA TIENE SALIDA A INTERNET por su puente $PUENTE_IA (llegó a $IP_SONDA:$SONDA_SALIDA_PUERTO): falta la regla de firewall del host que pone PI (I-464). Su código solo abre conexiones a la tailnet; se sigue por D-026. Con INV_IA_EXIGIR_SIN_SALIDA=1 esto aborta el despliegue"
}

registrar_estado() {
  local actual_id actual_sha
  actual_id="$(leer_estado imagen-actual)"
  actual_sha="$(leer_estado sha-actual)"
  if [ -n "$actual_id" ] && [ "$actual_id" != "$ID" ]; then
    escribir_atomico "$INV_ESTADO_DIR/imagen-anterior" "$actual_id"
    escribir_atomico "$INV_ESTADO_DIR/sha-anterior" "$actual_sha"
  fi
  escribir_atomico "$INV_ESTADO_DIR/imagen-actual" "$ID"
  escribir_atomico "$INV_ESTADO_DIR/sha-actual" "$SHA"
}

# La retención borra solo en producción. En modo prueba (en el Mac) las imágenes inv-008-*:<sha> y los .tar son
# los que la Fábrica construye y envía al VPS: el estado de prueba no sabe cuáles son, y borrarlos rompe el envío.
# Fail-closed: cualquier proyecto que no sea exactamente inv-008-prod (también vacío o sin definir) no borra nada.
retencion_permitida() {
  [ "${INV_PROYECTO_ACTIVO:-}" = "$INV_PROYECTO_PROD" ]
}

# Las guardas van con return explícito: estas funciones corren dentro de `||`, donde set -e no corta.
purgar_imagenes() {
  local anterior ref repo
  retencion_permitida || return 0
  anterior="$(leer_estado sha-anterior)"
  while IFS= read -r ref; do
    informar "retención: borrando $ref"
    docker image rm "$ref" >/dev/null || informar "⚠️  no se pudo borrar $ref (se sigue)"
  done < <(for repo in inv-008-app inv-008-migrador inv-008-vigia; do docker image ls --format '{{.Repository}}:{{.Tag}}' "$repo"; done |
    imagenes_a_purgar "$SHA" "$anterior")
}

purgar_tars() {
  local dir anterior archivo nombre
  retencion_permitida || return 0
  dir="$INV_RAIZ/imagenes"
  [ -d "$dir" ] || return 0
  dir="$(ruta_escribible "$dir")"
  anterior="$(leer_estado sha-anterior)"
  for archivo in "$dir"/inv-008-*.tar "$dir"/inv-008-*.tar.sha256; do
    [ -f "$archivo" ] || continue
    nombre="${archivo##*/}"
    [[ "$nombre" =~ ^inv-008-([0-9a-f]{40})\.tar(\.sha256)?$ ]] || continue
    [ "${BASH_REMATCH[1]}" = "$SHA" ] || [ "${BASH_REMATCH[1]}" = "$anterior" ] && continue
    rm -f "$(ruta_escribible "$archivo")"
    informar "retención: borrado $nombre"
  done
}

# La retención del final del despliegue. Sus fallas no afectan el despliegue; en modo prueba no borra nada y lo
# dice en una sola línea.
retener() {
  if ! retencion_permitida; then
    informar "retención: modo prueba (${INV_PROYECTO_ACTIVO:-}), no se borra ninguna imagen ni .tar"
    return 0
  fi
  purgar_imagenes || informar "⚠️  la retención de imágenes falló; no afecta el despliegue"
  purgar_tars || informar "⚠️  la retención de los .tar falló; no afecta el despliegue"
}

# Vuelta atrás: si el despliegue falla después de tocar contenedores, vuelve a levantar los permanentes con
# el sha que corría (las migraciones son aditivas: la imagen vieja sirve con la base nueva). Si se
# re-despliega el mismo sha, no hay otra imagen; pero si la app ya se detuvo para migrar, se levanta otra vez.
SHA_CORRIA=""
SHA_VUELTA=""
DETENIDOS=0
VERIFICADO=0
ESPERA=""
BAJO_PISO=""
CON_PRECIOS=0
UP_PERMANENTES=()
# La IP pública de la sonda que alcanzó la entrada (la fija verificar_sin_salida; la usa verificar_salida_ia).
IP_SONDA=""
vuelta_atras() {
  local codigo=$? sha="$SHA_VUELTA"
  [ -n "$sha" ] || [ "$DETENIDOS" = 0 ] || sha="$SHA_CORRIA"
  if [ "$VERIFICADO" = 0 ] && [ -n "$sha" ] && ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    informar "⚠️  estado/sha-actual no es un sha de 40 hex: no se vuelve a ninguna imagen. Revise a mano (produccion.md §5)."
    sha=""
  elif [ "$VERIFICADO" = 0 ] && [ -z "$sha" ] && [ "$DETENIDOS" = 1 ]; then
    informar "⚠️  no hay imagen a la que volver (primer despliegue): lo detenido para migrar queda abajo"
  fi
  if [ "$VERIFICADO" = 0 ] && [ -n "$sha" ] && ! respaldos_siguen_validos; then
    informar "⚠️  la carpeta de respaldos dejó de pasar la validación: no se vuelve a levantar nada. Revise a mano (produccion.md §5)."
    sha=""
  fi
  if [ "$VERIFICADO" = 0 ] && [ -n "$sha" ]; then
    informar "vuelta atrás: levantando de nuevo la imagen que corría (sha $sha)"
    permanentes_para "$sha"
    [ "$CON_PRECIOS" = 1 ] || informar "vuelta atrás: la imagen de $sha no trae el servicio de precios (o no se sabe): se baja inv-008-precios"
    if INV_TAG="$sha" "${COMPOSE[@]}" up -d --wait --wait-timeout 180 "${UP_PERMANENTES[@]}"; then
      informar "vuelta atrás hecha: corre $sha. Revise la causa antes de reintentar."
    else
      informar "⚠️  la vuelta atrás también falló: revise a mano (docs/despliegue/produccion.md, reversa)"
    fi
  fi
  exit "$codigo"
}

# El cierre, con el sha nuevo ya registrado: la revisión de convivencia y el piso de memoria de la espera corta. Si
# cualquiera falla, sale sin DEPLOY VERIFICADO y sin vuelta atrás (el sha nuevo corre y respondió sano): el corte es
# manual. Sale con el código de la convivencia o, si solo falló el piso, con 3 (el del criterio de corte).
cerrar() {
  local medicion="$1" rc=0
  "$INV_DIR_008/scripts/vigilar-convivencia.sh" || rc=$?
  VERIFICADO=1
  [ "$rc" = 0 ] || informar "la revisión de convivencia encontró el criterio de corte (código $rc): sin DEPLOY VERIFICADO. El corte es manual."
  [ -z "$BAJO_PISO" ] ||
    informar "MEMORIA BAJO EL PISO después de $ESPERA_COMPLETA_S s ($BAJO_PISO): sin DEPLOY VERIFICADO. Corre $SHA, quedó registrado y no se detuvo nada; el corte es manual: sudo $INV_DIR_008/scripts/pausar-008.sh (convivencia-pi.md §4)"
  [ "$rc" = 0 ] || exit "$rc"
  [ -z "$BAJO_PISO" ] || exit 3
  informar "mediciones en $medicion · anote el sha en ESTADO.md de la gestión"
  echo "DEPLOY VERIFICADO $SHA"
}

main() {
  local referencia="" tar="" tar_sha="" sin_migrar=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --sin-migrar) sin_migrar=1; shift ;;
      --cargar) tar="${2:-}"; tar_sha="${3:-}"; shift 3 || morir "--cargar necesita <archivo.tar> <sha256>" ;;
      -*) morir "opción desconocida: $1" ;;
      *) [ -z "$referencia" ] || morir "sobra el argumento $1"; referencia="$1"; shift ;;
    esac
  done
  [[ "$referencia" =~ ^(sha256:)?[0-9a-f]{64}$ || "$referencia" =~ ^inv-008-app:[0-9a-f]{40}$ ]] ||
    morir "uso: desplegar-prod.sh <id-imagen | inv-008-app:<sha>> [--cargar <archivo.tar> <sha256>] [--sin-migrar]"

  preparar_entorno
  revisar_arbol
  armar_compose
  avisar_pool_app
  # Si se define, manda sobre la comparación (como antes); se lee en base 10 (0613 son 613 s, no octal).
  local espera_explicita="${INV_ESPERA_MEDICION_S:-}"
  if [ -n "$espera_explicita" ]; then
    [[ "$espera_explicita" =~ ^[0-9]{1,5}$ ]] || morir "INV_ESPERA_MEDICION_S debe ser un entero de 0 a 99999 (segundos)"
    espera_explicita="$((10#$espera_explicita))"
  fi
  tomar_candado_propio
  tomar_candado_comun
  negarse_si_pausado
  guarda_disco
  revisar_pi "antes de empezar"
  [ -z "$tar" ] || cargar_tar "$tar" "$tar_sha"
  verificar_imagenes "$referencia"
  [ "$sin_migrar" = 1 ] || verificar_ci "$SHA"
  verificar_clon "$SHA" "$sin_migrar"
  verificar_sentido "$sin_migrar"
  export INV_TAG="$SHA"
  decidir_espera "$espera_explicita" "$(leer_estado sha-actual)"
  permanentes_para "$SHA" --estricto
  if [ "$CON_PRECIOS" = 1 ]; then
    informar "la imagen trae el servicio de precios: se levanta y se verifica con los permanentes"
  else
    informar "⚠️  la imagen no trae el servicio de precios (es anterior a él): se baja inv-008-precios (--scale 0) y se levanta lo demás"
  fi
  # Antes de tocar nada (el respaldo previo, la migración) y antes de la trampa: los límites que un daemon-reload del
  # host dejó sin efecto en lo que corre (la base casi nunca se recrea). Si no se pueden reaplicar, sale sin vuelta atrás
  # y sin tocar nada más que los límites que ya haya corregido (que quedan en lo declarado).
  reaplicar_limites

  local medicion
  medicion="$(ruta_escribible "$INV_ESTADO_DIR/mediciones/$SHA-$(date +%Y%m%d-%H%M%S).txt")"
  "$INV_DIR_008/scripts/medir-memoria.sh" --etiqueta "antes de up" --salida "$medicion"

  SHA_CORRIA="$(leer_estado sha-actual)"
  SHA_VUELTA="$SHA_CORRIA"
  [ "$SHA_VUELTA" != "$SHA" ] || SHA_VUELTA=""
  trap vuelta_atras EXIT

  # La carpeta de respaldos se valida ANTES del down de las redes viejas: si fallara después, quedaría todo abajo.
  respaldos_siguen_validos || morir "la carpeta de respaldos dejó de pasar la validación antes del up"
  bajar_si_redes_viejas
  informar "base y respaldo: up --wait"
  "${COMPOSE[@]}" up -d --wait --wait-timeout 180 inv-008-db inv-008-respaldo
  verificar_roles
  if [ "$sin_migrar" = 0 ]; then
    revisar_pi "antes de migrar"
    # Desde aquí la vuelta atrás vuelve a levantar la app aunque el sha sea el mismo.
    DETENIDOS=1
    informar "deteniendo la app vieja: no atiende ni retiene tablas durante el respaldo previo y la migración"
    "${COMPOSE[@]}" stop inv-008-app
  fi
  informar "respaldo cifrado antes de migrar"
  "$INV_DIR_008/scripts/respaldar-base.sh" --motivo pre-migracion >/dev/null

  if [ "$sin_migrar" = 0 ]; then
    informar "deteniendo el respaldo diario: su pg_dump no se cruza con la migración"
    "${COMPOSE[@]}" stop inv-008-respaldo
    informar "migrador (un solo uso, antes de servir): migraciones, guardián del esquema y privilegios"
    "${COMPOSE[@]}" run --rm -T inv-008-migrador
  fi

  revisar_pi "antes de up"
  respaldos_siguen_validos || morir "la carpeta de respaldos dejó de pasar la validación antes del up"
  local problema_ia
  problema_ia="$(problema_dir_compartida_ia "$INV_ENV_PROD")"
  [ -z "$problema_ia" ] || morir "$problema_ia (produccion.md §2)"
  informar "app, entrada, vigía, respaldo, IA y precios: up --wait"
  "${COMPOSE[@]}" up -d --wait --wait-timeout 180 "${UP_PERMANENTES[@]}"
  # La app y el respaldo ya están arriba: si algo falla después, se vuelve solo si hay otra imagen.
  DETENIDOS=0
  verificar_servicio
  verificar_sin_salida
  verificar_salida_ia
  # Otra vez, por si el reload del host pasó durante el despliegue (lo que el up no recreó). Si falla, vuelta atrás.
  reaplicar_limites
  verificar_memswap

  esperar_y_medir "$ESPERA" "$medicion"
  verificar_servicio

  # Recién aquí el sha nuevo queda como actual y se purga lo viejo (solo en producción): hasta este punto, la
  # vuelta atrás todavía tiene la imagen que corría.
  registrar_estado
  SHA_VUELTA=""
  retener
  cerrar "$medicion"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
