#!/bin/sh
# Inversiones · migrador de un solo uso (contenedor inv-008-migrador, rol inv_dueno). Corre ANTES de
# levantar la app (patrón de PI: migraciones antes de servir):
#   1. prisma migrate deploy (solo migraciones aditivas; nunca migrate dev ni db push en producción);
#   2. guardián del esquema: aborta si falta un índice parcial, CHECK, EXCLUDE, disparador o función
#      escritos a mano;
#   3. privilegios de inv_app, tabla por tabla.
# Si un paso falla, sale con error y desplegar-prod.sh no levanta la app.
set -eu
cd /app
: "${DATABASE_URL:?falta DATABASE_URL (rol inv_dueno)}"
echo "[migrador] 1/3 prisma migrate deploy"
node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
echo "[migrador] 2/3 guardián del esquema (scripts/verificar-esquema.sql)"
node_modules/.bin/prisma db execute --schema prisma/schema.prisma --file scripts/verificar-esquema.sql
echo "[migrador] 3/3 privilegios de inv_app (docker/migrador/privilegios.sql)"
node_modules/.bin/prisma db execute --schema prisma/schema.prisma --file docker/migrador/privilegios.sql
echo "[migrador] listo"
