#!/bin/bash
# Prisma / SQL raw solo dentro de src/lib/bi/* (fachada del motor) y del
# singleton src/lib/prisma.ts. El endpoint /api/bi/preguntar puede recibir
# `prisma` inyectado pero no puede escribir SQL.
if grep -rnE "\.query\(|prisma\.|SELECT " src/app/ src/components/ src/lib/ 2>/dev/null | \
   grep -v "\.test\." | \
   grep -v "src/lib/bi/" | \
   grep -v "src/lib/prisma.ts" | \
   grep -v "src/app/api/bi/preguntar/route.ts" ; then
    echo "❌ SQL raw fuera del motor · usa src/lib/bi/motor.ts"
    exit 1
fi
echo "✅ cero-sql-raw OK"
