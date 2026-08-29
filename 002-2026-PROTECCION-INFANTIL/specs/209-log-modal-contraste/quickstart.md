# Quickstart — SPEC-209

## Variables de entorno

Ninguna nueva.

## Pasos para probar localmente

1. Abrir `/dashboard/admin/estadisticas/operacion?tab=logs` → "Ver contexto".
2. Verificar que el bloque humano tiene fondo oscuro y texto claro en modo claro y oscuro.
3. Opcional: correr test visual.
   ```bash
   npm run test -- src/components/modules/monitoreo/LogContextoModal.test.tsx
   ```
