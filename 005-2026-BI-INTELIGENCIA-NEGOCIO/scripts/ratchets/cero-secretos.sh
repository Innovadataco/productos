#!/bin/bash
if grep -rnE "(sk-[a-zA-Z0-9]{20,}|password[:=]\s*['\"][^'\"]+['\"]|JWT_SECRET\s*=\s*['\"])" src/ scripts/ docker/ 2>/dev/null; then
    echo "❌ Secreto hardcoded detectado"
    exit 1
fi
echo "✅ ratchet 2 OK"
