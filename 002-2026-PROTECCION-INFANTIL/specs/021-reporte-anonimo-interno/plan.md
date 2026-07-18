# Plan — Spec 021: Reporte anónimo con sesión interna abierta

> Fecha: 2026-07-18.
> Estado: pendiente de decisión del owner.

## Decisión pendiente

Jelkin debe elegir entre:
- **Opción A**: tratar `/reportar` como anónimo para roles no-PARENT.
- **Opción B**: bloquear en el frontend con mensaje claro.

## Implementación según opción elegida

### Si elige A

1. Modificar `POST /api/reportes` (`src/app/api/reportes/route.ts`):
   - No rechazar a usuarios internos.
   - Para roles no-PARENT, tratar `user` como `null`: `esAnonimo = true`, `usuarioId = null`.
   - Opcional: loggear en `AuditLog` que la petición vino de sesión interna pero se procesó como anónima (sin vincular al reporte).
2. Verificar que `ReporteWizard` no requiera cambios.
3. Tests:
   - Reporte anónimo puro (sin sesión) sigue funcionando.
   - ADMIN/OPERADOR logueado puede reportar y el reporte queda `esAnonimo=true`, `usuarioId=null`.

### Si elige B

1. Modificar `ReporteWizard` (`src/components/modules/ReporteWizard.tsx`):
   - Detectar si hay sesión interna (ej. llamar a `/api/me`).
   - Mostrar mensaje explicativo + botón para cerrar sesión.
2. Mantener el 403 en `POST /api/reportes` para roles no-PARENT.
3. Tests:
   - UI muestra el bloqueo para sesión interna.
   - Anónimo puro sigue funcionando.

## Cierre

- Lint, tsc, build, tests, smoke-e2e verdes.
- `reporte-cierre.md`.
- Commit + push a `feature/001-scaffolding`.
- Desplegar app y worker en `:5005`.
