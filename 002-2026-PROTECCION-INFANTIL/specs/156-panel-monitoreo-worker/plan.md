# Plan: SPEC-156 — Panel de monitoreo del worker

## Enfoque

Página de ADMIN que consume `GET /api/health/worker` y muestra el estado del worker y la DB. Solo lectura, sin acciones destructivas.

## Decisiones

- Registrar nuevo módulo `monitoreo_worker` en `CATALOGO_MODULOS`.
- Reutilizar endpoint existente; si el endpoint es público, se mantiene; la página protege por rol.
- Cero botones destructivos.

## Fases

1. Registrar módulo en `src/lib/permisos-catalogo.ts` (o archivo equivalente) y `src/lib/permisos-modulos.ts`.
2. Crear página `/dashboard/admin/monitoreo/worker/page.tsx`.
3. Tests de integración.
4. Regenerar arquitectura.
5. Cierre y README.
