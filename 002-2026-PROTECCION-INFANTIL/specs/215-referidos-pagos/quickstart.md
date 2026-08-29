# Quickstart — SPEC-215

## Requisitos previos

- SPEC-210 aplicada.
- Motor notif con reglas `referido.*`.
- SPEC-213 para evento `pago.autorizado`.

## Pasos para probar

1. Registrar un nuevo cliente y verificar código generado:
   ```bash
   npx prisma studio
   # Ver Suscripcion.codigoReferidoPropio
   ```

2. Aplicar código:
   ```bash
   curl -X POST http://localhost:5005/api/pagos/aplicar-referido \
     -H "Content-Type: application/json" \
     -b "token=$TOKEN" \
     -d '{"suscripcionId":"<cuid>","codigoReferido":"PI-COLEGIO-A7F3D2E1"}'
   ```

3. Autorizar primer pago del referido (vía admin o BD) y verificar:
   - `CodigoReferidoUso.fechaActivacion`.
   - `referido.recompensa.otorgada` en cola.
   - Extensión de vigencia del referidor.

## Comandos de verificación

```bash
npx tsc --noEmit
npm run lint
npm run test -- referido
npm run build
```
