#!/bin/bash
if grep -rnE "\.query\(|prisma\.|SELECT " src/app/ src/components/ src/lib/ 2>/dev/null | \
   grep -v "\.test\." | grep -v "src/lib/bi/motor"; then
    echo "❌ SQL raw fuera del motor · usa src/lib/bi/motor.ts"
    exit 1
fi
echo "✅ ratchet 1 OK"
