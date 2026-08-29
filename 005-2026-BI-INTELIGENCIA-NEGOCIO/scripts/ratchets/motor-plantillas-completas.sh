#!/bin/bash
# SPEC-011 Capa 5 · candado 10: 4 plantillas deterministas deben existir en plantillas.ts
FILE="src/lib/bi/plantillas.ts"
if [ ! -f "$FILE" ]; then
    echo "❌ falta $FILE"
    exit 1
fi
for tag in "sin-datos" "un-numero" "tabla" "grafico"; do
    if ! grep -q "\"$tag\"" "$FILE"; then
        echo "❌ plantilla \"$tag\" ausente en $FILE"
        exit 1
    fi
done
echo "✅ motor-plantillas-completas OK"
