#!/usr/bin/env bash
# Candado 008 · datos reales fuera del repo (productos es PÚBLICO).
# Lista con git todo lo versionado en 008-2026-INVERSIONES/ y falla si algún archivo
# es de los que típicamente traen datos reales: extractos, exportaciones, capturas,
# bases de datos, comprimidos, claves o secretos.
# Excepción única: archivos de prueba INVENTADOS de datos, marcados `.ficticio.` en el nombre
# (nunca para claves ni secretos).
#
# Uso (desde la raíz del repo): bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.sh
#
# Las rutas se leen crudas y separadas por NUL (`core.quotepath=off`, `-z`): con la
# salida por defecto, git entrecomilla los nombres con tildes o eñes
# («"Informaci\303\263n.csv"») y la extensión deja de coincidir.
set -euo pipefail

carpeta="${CARPETA_008:-008-2026-INVERSIONES}"

# Imprime una ruta sin caracteres de control (evita romper el log o inyectar comandos de Actions).
mostrar() { printf '%s' "${1//[[:cntrl:]]/?}"; }

# Lo que llegue por stdin se ignora (el inv.yml de main le pasa una lista por tubería):
# el listado lo hace este script. No se lee stdin a propósito: si quedara abierto sin EOF,
# el candado se colgaría.

lista="$(mktemp)"
trap 'rm -f "$lista"' EXIT
git -c core.quotepath=off ls-files -z -- "$carpeta" >"$lista"

prohibidos=0
while IFS= read -r -d '' ruta; do
  nombre="${ruta##*/}"
  # Sin espacios ni puntos al final (`extracto.csv ` o `extracto.csv.` no deben escapar).
  while [[ "$nombre" == *" " || "$nombre" == *"." ]]; do nombre="${nombre%?}"; done
  minus="$(printf '%s' "$nombre" | tr '[:upper:]' '[:lower:]')"

  # Secretos y claves: siempre prohibidos, sin excepción `.ficticio.`.
  # (.env, .env.local, .env.production, prod.env, .envrc, *.pem, *.key, *.p12, *.pfx; se permite .env.example)
  if [[ "$minus" != ".env.example" ]]; then
    case "$minus" in
      .env|.env.*|*.env|.envrc|.netrc|id_rsa*|id_ed25519*|id_ecdsa*|\
      *.pem|*.key|*.p8|*.p12|*.pfx|*.jks|*.keystore|*.kdbx|*.ppk|*.gpg)
        echo "❌ Secreto o clave versionado: $(mostrar "$ruta")"
        prohibidos=$((prohibidos + 1))
        continue
        ;;
    esac
  fi

  case "$minus" in
    *.csv|*.tsv|*.xlsx|*.xls|*.xlsm|*.xlsb|*.ods|*.numbers|*.doc|*.docx|*.docm|*.pptx|*.pdf|*.ofx|*.qif|\
    *.png|*.jpg|*.jpeg|*.webp|*.avif|*.heic|*.heif|*.gif|*.bmp|*.tif|*.tiff|\
    *.zip|*.7z|*.gz|*.tgz|*.tar|*.rar|*.xz|*.bz2|\
    *.sqlite|*.sqlite3|*.db|*.mdb|*.dump|*.parquet|*.log|\
    *.bak|*.old|*.orig|*.csv.*|*.xlsx.*|*.pdf.*)
      # Excepción: el nombre termina EXACTAMENTE en `.ficticio.<ext>`, en minúsculas.
      sin_ext="${nombre%.*}"
      if [[ "$sin_ext" != *.ficticio ]]; then
        echo "❌ Posible dato real (extracto, exportación, captura, base o comprimido): $(mostrar "$ruta")"
        echo "   Si es un dato de prueba INVENTADO, renómbralo con «.ficticio.» (ej. ordenes.ficticio.csv)."
        prohibidos=$((prohibidos + 1))
      fi
      ;;
  esac
done <"$lista"

if (( prohibidos > 0 )); then
  echo "❌ candado-datos-reales: $prohibidos archivo(s) prohibido(s). Los datos reales viven solo en el servidor."
  exit 1
fi
echo "✅ candado-datos-reales: sin extractos, capturas, bases, claves ni secretos versionados."
