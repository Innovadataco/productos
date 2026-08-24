# Quickstart — SPEC-218

## Requisitos previos

- SPEC-210 y SPEC-213 implementadas.
- Datos de prueba: suscripciones, pagos, estados.
- Componentes de charts existentes.

## Pasos para probar

1. Navegar a `/dashboard/admin/estadisticas/dinero-vs-valor`.
2. Verificar KPIs en fila superior.
3. Verificar 4 widgets renderizados con datos.
4. Cambiar tamaño de ventana para probar responsive.
5. Verificar contraste con `npm run a11y:contrast`.

## Comandos de verificación

```bash
npx tsc --noEmit
npm run lint
npm run test -- analitica
npm run build
npm run a11y:contrast
```
