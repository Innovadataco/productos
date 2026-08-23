# Quickstart — SPEC-207

## Variables de entorno

Ninguna nueva.

## Pasos para probar localmente

1. Correr seed para actualizar parámetros:
   ```bash
   npx prisma db seed
   ```

2. Verificar valores:
   ```sql
   SELECT clave, valor FROM "ParametroSistema" WHERE clave LIKE 'spam.%';
   ```

3. Correr tests:
   ```bash
   npm run test -- src/lib/ai/guardas.test.ts
   ```
