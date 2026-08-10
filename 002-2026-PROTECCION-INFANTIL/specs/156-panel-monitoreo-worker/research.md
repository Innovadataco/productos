# Research: SPEC-156 — Panel de monitoreo del worker

## Capacidades existentes

- `GET /api/health/worker`: devuelve `{ status, workerAlive, dbOk, timestamp }`.
- `src/lib/worker-heartbeat.ts`: lectura del heartbeat.
- `src/lib/permisos-modulos.ts` y `src/lib/permisos-catalogo.ts`: catálogo de módulos.

## Patrones

- Páginas admin en `src/app/dashboard/admin/**`.
- Verificación de módulo con `verificarAccesoPagina`.

## Hallazgos

- No se requieren cambios en el endpoint de health; la página lo consume.
- Es necesario registrar el módulo para que aparezca en el menú y sea verificable.
