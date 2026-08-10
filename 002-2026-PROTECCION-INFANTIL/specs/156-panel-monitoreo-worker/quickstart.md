# Quickstart: SPEC-156 — Panel de monitoreo del worker

## Verificación local

1. Iniciar sesión como `ADMIN`.
2. Navegar a `/dashboard/admin/monitoreo/worker`.
3. Confirmar que se muestra el estado del worker (`workerAlive`, `dbOk`, `timestamp`).
4. Confirmar que NO hay botones de reinicio, detener, purgar cola, etc.
5. Cerrar sesión, iniciar como `SCHOOL_ADMIN` y confirmar 403.

## Verificación de API

```bash
curl -s http://localhost:5005/api/health/worker | jq .
```
