# Quickstart: Endurecimiento de Seguridad (Spec 046)

**Feature**: specs/046-endurecimiento-seguridad/spec.md
**Date**: 2026-07-20

---

## Prerrequisitos

- Tener el entorno levantado: `./scripts/dev-restart.sh`.
- Base de datos con seed aplicado: `npm run db:seed` (si es necesario).
- Variables de entorno en `.env.test` con `PARAM_ENCRYPTION_KEY` de 32 bytes.

---

## 1. Verificar CSP

```bash
curl -s -I http://localhost:5005/ | grep -i content-security-policy
```

Esperado: header presente, sin `unsafe-eval`, con `nonce-` en `script-src`.

```bash
curl -s http://localhost:5005/ | grep -o 'nonce="[^"]*"' | head
```

Esperado: `<script nonce="...">` en scripts inline si los hay.

---

## 2. Verificar tope de pageSize

```bash
curl -s "http://localhost:5005/api/config/parametros?pageSize=9999" \
  -H "Cookie: token=$ADMIN_TOKEN" | jq '.pagination.pageSize'
# Esperado: 100

ADMIN_TOKEN=$(curl -s -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ADMIN_PASSWORD"}' \
  -c - | grep token | awk '{print $7}')

curl -s "http://localhost:5005/api/admin/dataset-entrenamiento?pageSize=9999" \
  -H "Cookie: token=$ADMIN_TOKEN" | jq '.pageSize'
# Esperado: 100

PARENT_TOKEN=$(curl -s -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"parent@example.com","password":"TestPass123"}' \
  -c - | grep token | awk '{print $7}')

curl -s "http://localhost:5005/api/reportes/mis-reportes?pageSize=9999" \
  -H "Cookie: token=$PARENT_TOKEN" | jq '.pagination.pageSize'
# Esperado: 100
```

---

## 3. Verificar sanitización de errores

```bash
# Forzar un error inesperado (ejemplo: POST inválido a endpoint de IA sin Ollama disponible)
curl -s -X POST http://localhost:5005/api/admin/ia/ollama/probar \
  -H "Cookie: token=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:99999"}' | jq '.error'
# Esperado: {"message":"No se pudo conectar con Ollama","code":"INTERNAL_ERROR"}
```

No debe aparecer el mensaje técnico de la excepción (por ejemplo, `connect ECONNREFUSED`).

---

## 4. Verificar ausencia de PII en consulta pública

```bash
# Crear un reporte con texto que contiene PII y luego consultar el identificador
# (simplificado; el test e2e lo hace de forma automatizada)

# 1. Crear reporte anónimo
RESP=$(curl -s -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -d '{
    "identificador": "+57300QUICKSTART",
    "plataformaClave": "whatsapp",
    "texto": "Mi nombre es Juan Pérez y mi teléfono es +573001234567",
    "fechaIncidente": "2026-07-10",
    "ciudad": "Bogotá",
    "pais": "Colombia"
  }')

# 2. Procesar el reporte (worker)
# 3. Esperar a que pase a CLASIFICADO
# 4. Consultar

# La respuesta de /api/consulta NO debe incluir el texto original ni el nombre/teléfono.
curl -s "http://localhost:5005/api/consulta?identificador=%2B57300QUICKSTART" | jq '.reportes'
# Esperado: array vacío o datos agregados sin texto
```

---

## 5. Ejecutar tests

```bash
# Unit + integration
npm run test

# E2E
npm run test:e2e

# Types
npx tsc --noEmit

# Lint
npm run lint
```

---

## 6. Reinicio limpio

```bash
./scripts/dev-restart.sh
```

Verificar healthcheck:

```bash
curl -s http://localhost:5005/api/health/worker
```

Esperado: `{"status":"ok","workerAlive":true,"dbOk":true,...}`.

---

## 7. Verificar inventario de PII

Leer `docs/pii-inventory.md` y confirmar que incluye al menos 10 campos/entidades con tratamiento.

---

## 8. Verificar plan de rotación de clave

Leer `specs/046-endurecimiento-seguridad/research.md` sección 5 y confirmar que incluye:

- Versionado (`enc:vN:...`).
- Múltiples claves.
- Script de re-cifrado offline.
- Rollback.
- Compatibilidad hacia atrás.

No se espera código productivo para US6.
