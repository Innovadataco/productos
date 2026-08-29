#!/bin/bash
if grep -rnE "from 'ollama'|from 'openai'|http://.*11434|http://.*11435" src/ 2>/dev/null | \
   grep -v "src/lib/bi/motor.ts" | grep -v "\.test\."; then
    echo "❌ Import LLM directo · usa src/lib/bi/motor.ts"
    exit 1
fi
echo "✅ ratchet 3 OK"
