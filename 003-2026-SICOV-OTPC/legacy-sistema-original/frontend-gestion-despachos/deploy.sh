#!/bin/bash
set -e

# =========================
# CONFIGURACI�N
# =========================
APP_NAME="frontend-gestion-despachos"
REPO="https://github.com/ingnovaott-maker/frontend-gestion-despachos.git"

BASE_PATH="/var/aplicacion/frontend-gestion-despachos"
RELEASES_PATH="$BASE_PATH/releases"

WWW_PATH="/var/www/gesmovilapp"
KEEP_RELEASES=3
NODE_MEMORY=2048

DATE=$(date +%Y-%m-%d_%H-%M-%S)

echo "?? Desplegando FRONT: $APP_NAME"
echo "?? Release: $DATE"

# =========================
# 0. Preparar estructura
# =========================
mkdir -p "$RELEASES_PATH"
mkdir -p "$WWW_PATH"

# =========================
# 1. Nuevo release
# =========================
cd "$RELEASES_PATH"
git clone "$REPO" "$DATE"
cd "$DATE"

# =========================
# 2. Instalar dependencias
# =========================
echo "?? Instalando dependencias"
npm install

# =========================
# 3. Build producci�n Angular
# =========================
echo "???  Build Angular producci�n"
NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY}" \
npm run build -- --configuration production

# =========================
# 4. Publicar en Apache
# =========================
echo "?? Publicando en Apache"

# Limpiar www actual
rm -rf "$WWW_PATH"/*

# Copiar build real de Angular 20
cp -r dist/frontend-dev/browser/* "$WWW_PATH/"

# Permisos seguros
chown -R www-data:www-data "$WWW_PATH"
chmod -R 755 "$WWW_PATH"

# =========================
# 5. Limpieza releases antiguos
# =========================
echo "?? Limpiando releases antiguos"
cd "$RELEASES_PATH"
ls -1dt */ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

# =========================
# 6. Reload Apache
# =========================
echo "?? Recargando Apache"
systemctl reload apache2

echo "? Despliegue completado correctamente"
