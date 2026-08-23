# Research — SPEC-207

## Decisiones ya cerradas por ZEUS / brief

1. **Umbral dominancia 0.33**: un voto SPAM en secundarias basta si ninguna categoría alcanza severidad ≥75.
2. **Hard-rule determinística ANTES de guarda dominancia**: red de seguridad ante rúbrica LLM equivocada.
3. **Dominios acortadores en parámetro JSON**: ajuste en caliente sin deploy.
4. **Log de modelo sin voto en sandbox**: instrumentación aditiva, sin cambio de comportamiento.

## Patrones del repo a reutilizar

- `src/lib/ai/guardas.ts`: guardas SPAM existentes (`spam_confianza_alta`, `spam_dominancia`).
- `prisma/seed.ts`: semilla de parámetros con `upsert`.
- `src/lib/ai/sandbox.ts`: llamado a rúbrica y manejo de modelos.
