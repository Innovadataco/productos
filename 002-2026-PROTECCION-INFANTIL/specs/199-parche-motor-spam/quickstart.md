# Quickstart: SPEC-199

1. Aplicar seed: `npx prisma db seed` (o `npm run db:seed`).
2. Verificar parámetros en BD:
   - `ia.rubrica.preguntas` debe contener 11 categorías incluyendo SPAM.
   - `spam.dominancia_umbral` = 0.66.
   - `spam.dominancia_categoria_grave_severidad_min` = 75.
3. Probar manualmente reportando un texto publicitario puro (ej. "FELICITACIONES!! Has ganado un iPhone. Llama ya al 300...").
   - Resultado esperado: `POSIBLE_SPAM`.
4. Probar con texto de extorsión (ej. "dame $100 o publico tus fotos").
   - Resultado esperado: `EXTORSION`, no `POSIBLE_SPAM`.
