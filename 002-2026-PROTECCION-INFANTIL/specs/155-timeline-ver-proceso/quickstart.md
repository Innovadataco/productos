# Quickstart: SPEC-155 — Timeline "Ver proceso"

## Verificación local

1. Iniciar sesión como `ADMIN`.
2. Navegar a `/dashboard/admin/reportes/<id>/proceso` para un reporte con transiciones/reintentos.
3. Confirmar que se muestran eventos ordenados cronológicamente.
4. Verificar que no aparece texto del reporte.
5. Cerrar sesión, iniciar como `OPERADOR` y confirmar 403.

## Verificación de API

```bash
curl -s -H "Cookie: token=<jwt-admin>" \
  "http://localhost:5005/api/admin/reportes/<id>/proceso" | jq .
```
