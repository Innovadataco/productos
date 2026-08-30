#!/bin/bash
# Candado 1 (SPEC-011..014): fachada única para LLM/Vanna.
# Cualquier acceso directo a Ollama/OpenAI o a VANNA_BASE_URL fuera de la
# whitelist rompe el candado. La whitelist es explícita, no por convención.

PATRON="from 'ollama'|from 'openai'|http://.*11434|http://.*11435|VANNA_BASE_URL"
# Whitelist:
# - motor.ts / vanna-client.ts / embedding.ts: fachada NL→SQL (generación).
# - estado-sistema/route.ts: healthcheck /health de bi-vanna (no genera SQL,
#   solo verifica up/down agregado con Superset y PI-app · SPEC-027).
if grep -rnE "$PATRON" src/ 2>/dev/null | \
   grep -v "src/lib/bi/motor.ts" | \
   grep -v "src/lib/bi/vanna-client.ts" | \
   grep -v "src/lib/bi/embedding.ts" | \
   grep -v "src/app/api/bi/estado-sistema/route.ts" | \
   grep -v "\.test\." | \
   grep -v "\.spec\." ; then
    echo "❌ Import LLM/Vanna directo · usa src/lib/bi/motor.ts, vanna-client.ts o embedding.ts"
    exit 1
fi
echo "✅ imports-llm-solo-motor OK"
