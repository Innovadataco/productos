# Plan — Spec 021: Reporte anónimo con sesión interna abierta

> Fecha: 2026-07-18.
> Decisión del owner: **Opción B** — bloquear en el frontend manteniendo el 403 en backend.

## Implementación

1. **Frontend** (`src/components/modules/ReporteWizard.tsx`):
   - Al montar, llamar `GET /api/me` para detectar sesión.
   - Si el rol es `ADMIN`, `OPERADOR` o `SCHOOL_ADMIN`, mostrar mensaje de bloqueo + botón para cerrar sesión.
   - El botón llama `POST /api/auth/logout` y recarga con `window.location.reload()`.
2. **Backend** (`src/app/api/reportes/route.ts`): no se modifica; mantiene el rechazo a roles no-PARENT como salvaguarda.
3. **Tests**:
   - Verificar que anónimo puro (sin sesión) sigue creando reportes.
   - Verificar que PARENT sigue creando reportes.
   - Verificar que ADMIN/OPERADOR reciben 403 por API (backend intacto).
   - Test unitario del bloqueo UI en `ReporteWizard`.

## Cierre

- Lint, tsc, build, tests, smoke-e2e verdes.
- `reporte-cierre.md`.
- Commit + push a `feature/001-scaffolding`.
- Desplegar app y worker en `:5005`.
