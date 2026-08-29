#!/bin/bash
if grep -rnE "additionalProperties\s*:\s*true" docker/vanna/ src/lib/bi/ 2>/dev/null; then
    echo "❌ additionalProperties:true en schema Vanna · viola candado 1"
    exit 1
fi
echo "✅ ratchet 4 OK"
