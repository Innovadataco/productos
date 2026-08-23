# Quickstart — SPEC-206

## Variables de entorno

Ninguna nueva obligatoria. Reutiliza:
- `DATABASE_URL`
- `JWT_SECRET`
- `ANTI_ABUSO_SALT` (mínimo 32 caracteres)
- `WORKER_SECRET`

## Pasos para probar localmente

1. Aplicar migración:
   ```bash
   npx prisma migrate dev --name add_sesion_log
   ```

2. Sembrar parámetros:
   ```bash
   npx prisma db seed
   ```

3. Levantar app:
   ```bash
   npm run dev
   ```

4. Levantar worker de sesiones (en otra terminal):
   ```bash
   npm run worker:sesiones
   ```

5. Probar flujo:
   - Hacer login; verificar que `SesionLog` se crea.
   - Esperar 5 minutos con la pestaña visible; verificar que `ultimaActividadEn` se actualiza.
   - Dejar la pestaña oculta; verificar que no hay pings.
   - Dejar la sesión inactiva 30+ minutos; verificar que el worker la cierra.
   - Como admin, ir a `/dashboard/admin/estadisticas/operacion?tab=sesiones` y forzar cierre.

## Comandos de gate

```bash
npx tsc --noEmit
npm run lint -- --no-cache
npm run arch:check
npm run test
npm run build
```
