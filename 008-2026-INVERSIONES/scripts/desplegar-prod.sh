#!/usr/bin/env bash
# Inversiones · despliegue en el VPS de producción compartido con PI. Mismo patrón que el deploy-prod.sh
# de PI: candado, guarda de disco, migraciones ANTES de servir (contenedor de un solo uso), healthcheck y
# «DEPLOY VERIFICADO <sha>» como ÚLTIMA línea solo si todo pasó. Las imágenes se construyen en el Mac.
#
# Uso (en el VPS, con sudo, desde el clon /opt/inversiones-008/repo puesto en el sha):
#   sudo scripts/desplegar-prod.sh <id-imagen | inv-008-app:<sha>> [--cargar <archivo.tar> <sha256>]
#   sudo scripts/desplegar-prod.sh inv-008-app:<sha> --sin-migrar     (reversa a la imagen actual o anterior;
#                                                                     no consulta GitHub)
#
# Orden: marca de pausa → candados (Inversiones y común con PI) → disco → PI sin desplegar → (.tar:
# etiquetas, sha256 y disco; docker load) → las tres imágenes del mismo sha, amd64 → CI en verde y sha en
# main → clon en el sha, limpio y de root → solo hacia adelante → medición → base y respaldo → roles →
# PI otra vez → (si migra) app vieja detenida → respaldo cifrado → (si migra) respaldo diario detenido →
# migrador (migraciones, guardián del esquema y privilegios) → app, vigía y respaldo → imagen, salud,
# mem = memswap → estado → retención → medición 10 min después → salud otra vez → convivencia →
# DEPLOY VERIFICADO <sha>. Si algo falla después de tocar contenedores, vuelve a la imagen que corría.
# Mientras migra no corre nada de Inversiones que retenga tablas: la app queda abajo desde el respaldo previo
# hasta que el up de la versión nueva queda healthy.
set -euo pipefail
INV_SCRIPT=desplegar-prod
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

MIN_DISCO_GB_POR_DEFECTO=15
ESPERA_MEDICION_S_POR_DEFECTO=600
PERMANENTES=(inv-008-app inv-008-vigia inv-008-respaldo)
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

# Verdadero solo si `docker port <app> 5008` publica únicamente 127.0.0.1:5008 (nunca 0.0.0.0 ni [::]).
puerto_publicado_ok() {
  [ "$1" = "127.0.0.1:5008" ]
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
      informar "⚠️  connection_limit de la URL de la app fuera de 1 a $TOPE_POOL_APP (inv_app admite 10 conexiones): se sigue; corríjalo en el archivo de producción (produccion.md §2)" ;;
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

verificar_clon() {
  local sha="$1" cabeza
  cabeza="$(git -C "$INV_DIR_008" rev-parse HEAD)"
  [ "$cabeza" = "$sha" ] || morir "el clon está en $cabeza, no en $sha: git -C /opt/inversiones-008/repo fetch && git checkout $sha"
  [ -z "$(git -C "$INV_DIR_008" status --porcelain --untracked-files=no)" ] || morir "el clon tiene cambios sin commit: no se despliega"
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
# memory.swap.max debe ser 0: si no, el tope de memoria no es real (el VPS tiene swap).
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

verificar_servicio() {
  local cid imagen salud estado version puertos_db corriendo
  cid="$("${COMPOSE[@]}" ps -q inv-008-app)"
  [ -n "$cid" ] || morir "no hay contenedor de la app"
  # Un contenedor que sale o se reinicia es un fallo, no algo pasajero (instrumentation.ts hace
  # process.exit(1) sin AUTH_SECRET o sin APP_ORIGEN, y restart: always lo vuelve a levantar).
  corriendo="$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' "$cid")"
  [ "$corriendo" = "running 0" ] || morir "la app no quedó corriendo de una vez (estado y reinicios: $corriendo): revise sus logs"
  imagen="$(normalizar_id "$(docker inspect -f '{{.Image}}' "$cid")")" || morir "no se pudo leer la imagen del contenedor"
  [ "$imagen" = "$ID" ] || morir "la app corre $imagen y no la imagen enviada $ID"
  salud="$(docker exec "$cid" wget -qO- http://127.0.0.1:5008/api/salud)" || morir "/api/salud no respondió 200"
  estado="$(printf '%s' "$salud" | jq -r '.estado // empty' 2>/dev/null)" || estado=""
  version="$(printf '%s' "$salud" | jq -r '.version // empty' 2>/dev/null)" || version=""
  [ "$estado" = "ok" ] || morir "/api/salud no dice ok (estado: ${estado:-ilegible})"
  [ "$version" = "$SHA" ] || morir "/api/salud dice la versión «$version», no $SHA"
  if [ "$INV_PROYECTO_ACTIVO" = "$INV_PROYECTO_PROD" ]; then
    puerto_publicado_ok "$(docker port "$cid" 5008)" || morir "la app no está publicada solo en 127.0.0.1:5008"
  fi
  cid="$("${COMPOSE[@]}" ps -q inv-008-db)"
  puertos_db="$(docker port "$cid")"
  [ -z "$puertos_db" ] || morir "la base publica puertos ($puertos_db): debe quedar solo en la red interna"
  informar "la app corre la imagen enviada y /api/salud responde ok con la versión $SHA"
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

purgar_imagenes() {
  local anterior ref repo
  anterior="$(leer_estado sha-anterior)"
  while IFS= read -r ref; do
    informar "retención: borrando $ref"
    docker image rm "$ref" >/dev/null || informar "⚠️  no se pudo borrar $ref (se sigue)"
  done < <(for repo in inv-008-app inv-008-migrador inv-008-vigia; do docker image ls --format '{{.Repository}}:{{.Tag}}' "$repo"; done |
    imagenes_a_purgar "$SHA" "$anterior")
}

purgar_tars() {
  local dir anterior archivo nombre
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

# Vuelta atrás: si el despliegue falla después de tocar contenedores, vuelve a levantar los permanentes con
# el sha que corría (las migraciones son aditivas: la imagen vieja sirve con la base nueva). Si se
# re-despliega el mismo sha, no hay otra imagen; pero si la app ya se detuvo para migrar, se levanta otra vez.
SHA_CORRIA=""
SHA_VUELTA=""
DETENIDOS=0
VERIFICADO=0
vuelta_atras() {
  local codigo=$? sha="$SHA_VUELTA"
  [ -n "$sha" ] || [ "$DETENIDOS" = 0 ] || sha="$SHA_CORRIA"
  if [ "$VERIFICADO" = 0 ] && [ -n "$sha" ]; then
    informar "vuelta atrás: levantando de nuevo la imagen que corría (sha $sha)"
    if INV_TAG="$sha" "${COMPOSE[@]}" up -d --wait --wait-timeout 180 "${PERMANENTES[@]}"; then
      informar "vuelta atrás hecha: corre $sha. Revise la causa antes de reintentar."
    else
      informar "⚠️  la vuelta atrás también falló: revise a mano (docs/despliegue/produccion.md, reversa)"
    fi
  fi
  exit "$codigo"
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
  local espera="${INV_ESPERA_MEDICION_S:-$ESPERA_MEDICION_S_POR_DEFECTO}"
  [[ "$espera" =~ ^[0-9]+$ ]] || morir "INV_ESPERA_MEDICION_S debe ser un entero"
  tomar_candado_propio
  tomar_candado_comun
  negarse_si_pausado
  guarda_disco
  revisar_pi "antes de empezar"
  [ -z "$tar" ] || cargar_tar "$tar" "$tar_sha"
  verificar_imagenes "$referencia"
  [ "$sin_migrar" = 1 ] || verificar_ci "$SHA"
  verificar_clon "$SHA"
  verificar_sentido "$sin_migrar"
  export INV_TAG="$SHA"

  local medicion
  medicion="$(ruta_escribible "$INV_ESTADO_DIR/mediciones/$SHA-$(date +%Y%m%d-%H%M%S).txt")"
  "$INV_DIR_008/scripts/medir-memoria.sh" --etiqueta "antes de up" --salida "$medicion"

  SHA_CORRIA="$(leer_estado sha-actual)"
  SHA_VUELTA="$SHA_CORRIA"
  [ "$SHA_VUELTA" != "$SHA" ] || SHA_VUELTA=""
  trap vuelta_atras EXIT

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
  informar "app, vigía y respaldo: up --wait"
  "${COMPOSE[@]}" up -d --wait --wait-timeout 180 "${PERMANENTES[@]}"
  # La app y el respaldo ya están arriba: si algo falla después, se vuelve solo si hay otra imagen.
  DETENIDOS=0
  verificar_servicio
  verificar_memswap

  informar "esperando ${espera}s para la medición después de up"
  sleep "$espera"
  "$INV_DIR_008/scripts/medir-memoria.sh" --etiqueta "10 min después de up" --salida "$medicion"
  verificar_servicio

  # Recién aquí el sha nuevo queda como actual y se purga lo viejo: hasta este punto, la vuelta atrás
  # todavía tiene la imagen que corría.
  registrar_estado
  SHA_VUELTA=""
  purgar_imagenes || informar "⚠️  la retención de imágenes falló; no afecta el despliegue"
  purgar_tars || informar "⚠️  la retención de los .tar falló; no afecta el despliegue"
  "$INV_DIR_008/scripts/vigilar-convivencia.sh" || {
    local rc=$?
    VERIFICADO=1
    informar "la revisión de convivencia encontró el criterio de corte (código $rc): sin DEPLOY VERIFICADO. El corte es manual."
    exit "$rc"
  }
  VERIFICADO=1
  informar "mediciones en $medicion · anote el sha en ESTADO.md de la gestión"
  echo "DEPLOY VERIFICADO $SHA"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
