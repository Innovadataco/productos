# Quickstart — SPEC-217

## Requisitos previos

- SPEC-210 aplicada.
- SPEC-213 (worker vigencia) listo o con stub.
- Parámetros `pagos.freemium.activo` y `pagos.freemium.duracion_dias` sembrados.

## Pasos para probar

1. Registrar un nuevo cliente (rector/padre).
2. Verificar en BD:
   ```bash
   npx prisma studio
   # Suscripcion: estado=ACTIVA, esFreemium=true, freemiumFechaFin futuro
   ```
3. Consultar estado:
   ```bash
   curl http://localhost:5005/api/pagos/suscripcion -b "token=$TOKEN"
   ```
4. Simular pago durante freemium y verificar `esFreemium=false` y `fechaFin` extendida.
5. Simular vencimiento sin pago y verificar transición a `SUSPENDIDA`.

## Comandos de verificación

```bash
npx tsc --noEmit
npm run lint
npm run test -- freemium
npm run build
```
