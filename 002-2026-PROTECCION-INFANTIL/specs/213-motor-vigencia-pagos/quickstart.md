# Quickstart — SPEC-213

## Requisitos previos

- SPEC-210 aplicada.
- Motor de Notificaciones disponible con catálogo de eventos §10 sembrado.
- Docker Compose funcional.

## Pasos para probar

1. Construir imagen (si aplica):
   ```bash
   docker compose build pi-vigencia
   ```

2. Ejecutar worker manualmente:
   ```bash
   node scripts/worker-vigencia-pagos.mjs --now
   ```

3. Verificar transiciones:
   ```bash
   npx prisma studio
   # Crear Suscripcion ACTIVA con fechaFin = hoy Bogotá
   # Ejecutar worker
   # Verificar que pasó a EN_GRACIA
   ```

4. Verificar idempotencia:
   ```bash
   node scripts/worker-vigencia-pagos.mjs --now
   # Segunda ejecución no debe generar eventos duplicados
   ```

5. Verificar log de eventos:
   ```bash
   docker compose logs -f pi-vigencia
   ```

## Comandos de verificación

```bash
npx tsc --noEmit
npm run lint
npm run test -- vigencia
npm run build
docker compose config
```
