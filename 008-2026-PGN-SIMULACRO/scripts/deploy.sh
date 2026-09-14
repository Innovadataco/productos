#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Instalando dependencias..."
npm install

echo "Sembrando base de datos..."
npm run db:seed

echo "Cargando contenido..."
npm run db:load-content || true

echo "Compilando export estático..."
npm run build

echo "Reiniciando contenedor..."
docker compose down
docker compose up -d

echo "Despliegue completado."
