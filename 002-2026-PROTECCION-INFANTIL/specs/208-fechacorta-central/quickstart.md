# Quickstart — SPEC-208

## Variables de entorno

Ninguna nueva.

## Pasos para probar localmente

1. Correr tests del helper:
   ```bash
   npm run test -- src/lib/format/fecha.test.ts
   ```

2. Verificar que no quedan copias:
   ```bash
   grep -rn "function fechaCorta" src/app/ src/components/
   grep -rn "toLocaleDateString.*es-CO" src/
   ```
