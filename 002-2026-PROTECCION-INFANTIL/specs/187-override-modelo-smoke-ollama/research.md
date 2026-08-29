# Research: SPEC-187 — Override de modelo para smoke Ollama

## Contexto

SPEC-186 rediseñó el smoke de Ollama para no recargar el modelo cada 5 min. La selección de modelo quedó anclada a `ia.rubrica.modelos[0]` (modelo vigente del motor).

ZEUS detecta que, para ciertos entornos o pruebas, es útil poder desacoplar el modelo de smoke del modelo de producción sin alterar la rúbrica. Por ejemplo:
- Usar `llama-guard3:8b` (más ligero) solo para smokes.
- Probar un candidato nuevo sin cambiar el modelo que clasifica reportes reales.

## Decisión de diseño

Override explícito por parámetro con fallback seguro:
1. Leer `monitoreo.ollama.smoke.modelo`.
2. Si no está vacío → usarlo.
3. Si está vacío/inexistente → usar `ia.rubrica.modelos[0]`.

Esto conserva el comportamiento actual por defecto y no rompe configuraciones existentes.

## Alternativas descartadas

- **Lista de modelos para smoke**: innecesario; con un override basta.
- **Cambiar `ia.rubrica.modelos[0]`**: afectaría la clasificación real de reportes; no se toca el motor.
