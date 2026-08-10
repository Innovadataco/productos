# Quickstart: SPEC-154 — Confianza

## Verificación local

1. Iniciar sesión como `SCHOOL_ADMIN` de un colegio.
2. Navegar a `/dashboard/colegio/confianza`.
3. Verificar que se listan los documentos: Transparencia, Protocolo y Compromiso.
4. Seleccionar un documento y confirmar que se renderiza sin HTML crudo.
5. Revisar la tabla "Historial de auditoría" y confirmar eventos de los últimos 90 días.
6. Hacer clic en "Descargar PDF" y verificar que el archivo se descarga correctamente.
7. Cerrar sesión, iniciar como `ADMIN` y confirmar que `/dashboard/colegio/confianza` devuelve 403.

## Verificación de API

```bash
curl -s -H "Cookie: token=<jwt-school-admin>" \
  "http://localhost:5005/api/colegio/confianza/auditoria?dias=30" | jq .

curl -s -H "Cookie: token=<jwt-school-admin>" \
  "http://localhost:5005/api/colegio/confianza/protocolo/pdf" \
  -o /tmp/protocolo.pdf
```
