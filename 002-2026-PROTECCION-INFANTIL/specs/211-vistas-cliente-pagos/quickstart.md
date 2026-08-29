# Quickstart — SPEC-211

## Requisitos previos

- SPEC-210 aplicada.
- Layouts `/dashboard/colegio/*` y `/dashboard/padre/*` disponibles.
- Usuarios de prueba con roles `SCHOOL_ADMIN` y `PARENT`.

## Pasos para probar

1. Iniciar sesión como rector y navegar a `/dashboard/colegio/suscripcion`.
2. Verificar los 7 bloques.
3. Probar formulario de renovación subiendo comprobante.
4. Verificar en BD que se creó `Pago` en `PENDIENTE_AUTORIZACION`.
5. Repetir como padre en `/dashboard/padre/suscripcion`.

## Comandos de verificación

```bash
npx tsc --noEmit
npm run lint
npm run test -- suscripcion
npm run build
npm run test:e2e -- suscripcion
```
