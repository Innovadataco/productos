#!/bin/bash
# Regla dura I-22/I-142/I-144 PI: cero secretos en código/scripts/docker.
# Excluye venvs Python y __pycache__ (herramientas locales de test).
if grep -rnE "(sk-[a-zA-Z0-9]{20,}|password[:=]\s*['\"][^'\"]+['\"]|JWT_SECRET\s*=\s*['\"])" src/ scripts/ docker/ 2>/dev/null | \
   grep -v "/\.venv/" | \
   grep -v "__pycache__" | \
   grep -v "\.pyc:" ; then
    echo "❌ Secreto hardcoded detectado"
    exit 1
fi
echo "✅ cero-secretos OK"
