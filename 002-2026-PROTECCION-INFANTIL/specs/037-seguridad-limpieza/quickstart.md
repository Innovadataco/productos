# Quickstart: Validación de Fixes de seguridad y limpieza

**Prerequisites**: Docker, Node.js >=22, app en puerto 5005, usuario admin creado por seed.

---

## 1. Iniciar/reiniciar entorno limpio

```bash
./scripts/dev-restart.sh
```

Verificar que el healthcheck finaliza con éxito.

---

## 2. Login como admin

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'
```

**Esperado**: `200` con `{ user: { rol: "ADMIN" } }` y cookie `token`.

---

## 3. Validar rate limiting en endpoint admin

### 3.1 Leer operadores (admin_read)

```bash
curl -s -D - http://localhost:5005/api/admin/operadores -b cookies.txt | head -n 15
```

**Esperado**: `200` y encabezados `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 3.2 Crear operador (admin_write)

```bash
curl -s -D - -X POST http://localhost:5005/api/admin/operadores \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"op-test@example.com","nombre":"Operador Test","rol":"OPERADOR"}' | head -n 15
```

**Esperado**: `201` o `409` si el email ya existe; headers de rate limit presentes.

### 3.3 Forzar límite de escritura (opcional)

Ejecutar el POST anterior ~31 veces en menos de 60s:

```bash
for i in $(seq 1 31); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5005/api/admin/operadores \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -d "{\"email\":\"op-$i@example.com\",\"nombre\":\"Operador $i\",\"rol\":\"OPERADOR\"}"
done
```

**Esperado**: Algunas peticiones retornan `429` con `Retry-After` y `code: RATE_LIMITED`.

---

## 4. Validar sanitización de error en transición

### 4.1 Forzar un error en procesamiento

Una forma práctica es hacer un POST a `/api/reportes/procesar` con `x-worker-secret` correcto y un `reporteId` que provoque un error (por ejemplo, un texto que dispare un error controlado en el pipeline).

```bash
curl -X POST http://localhost:5005/api/reportes/procesar \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: $WORKER_SECRET" \
  -d '{"reporteId":"REPORTE_ID"}'
```

### 4.2 Consultar transiciones del reporte

Desde el panel o vía API admin:

```bash
curl -s http://localhost:5005/api/admin/reportes/REPORTE_ID/transiciones -b cookies.txt | jq
```

**Esperado**: La transición a `REVISION_MANUAL` tiene un `motivo` genérico (p. ej., "Error durante el procesamiento del reporte") y los `metadatos` contienen un `errorCode` (p. ej., `INTERNAL_ERROR` o un código de Prisma), no el texto crudo del error original.

---

## 5. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests existentes pasan sin errores nuevos.

---

## 6. Verificar build y tipos

```bash
rm -rf .next
npx tsc --noEmit
npm run lint
npm run build
```

**Esperado**: Compila y pasa lint sin errores nuevos.
