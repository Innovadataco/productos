# Quickstart — SPEC-216

## Requisitos previos

- SPEC-210 aplicada (modelos y seed de pagos).
- Motor de Notificaciones disponible con regla `bono.aplicado` sembrada (o stub documentado).
- Al menos un `BonoPromocional` creado (vía seed o CRUD admin de SPEC-212).

## Pasos para probar

1. Levantar la app y la base:
   ```bash
   docker compose up -d db
   npm run dev
   ```

2. Crear un bono de prueba (si no existe):
   ```bash
   npx prisma studio
   # Insertar BonoPromocional con nombre=BOGOTA_UNCOLI_2026, tipo=DESCUENTO_PCT, valor=15, activo=true, vigencia futura
   ```

3. Autenticarse como rector/padre y obtener cookie `token`.

4. Aplicar el bono:
   ```bash
   curl -X POST http://localhost:5005/api/pagos/aplicar-bono \
     -H "Content-Type: application/json" \
     -b "token=$TOKEN" \
     -d '{"suscripcionId":"<cuid>","codigoBono":"BOGOTA_UNCOLI_2026"}'
   ```

5. Verificar en BD:
   - `BonoAplicado` creado.
   - `AuditLog` con acción `bono_aplicado`.
   - Cola del motor notif con evento `bono.aplicado`.

6. Repetir la petición y verificar 409 `bono_ya_aplicado`.

## Comandos de verificación

```bash
npx tsc --noEmit
npm run lint
npm run test -- bono-aplicacion
npm run build
```
