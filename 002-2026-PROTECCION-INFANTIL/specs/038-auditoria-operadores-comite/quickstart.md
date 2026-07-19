# Quickstart: Validación de Auditoría de Operadores y Comité

**Prerequisites**: Docker, Node.js >=22, PostgreSQL corriendo, app en `http://localhost:5005`, sesión de `ADMIN`.

---

## 1. Login como ADMIN

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'
```

**Esperado**: `200` con `{ user: { rol: "ADMIN" } }` y cookie `token`.

---

## 2. Verificar auditoría de operadores (API)

```bash
curl "http://localhost:5005/api/admin/audit-logs?acciones=OPERADOR_CREADO,OPERADOR_ACTIVADO,OPERADOR_DESACTIVADO&pageSize=5" \
  -b cookies.txt
```

**Esperado**: `200` con `{ items: [...], pagination: { page, pageSize, total, totalPages } }`. Cada ítem debe incluir `accion`, `tipoRecurso`, `recursoId`, `usuario { nombre, email }`, `creadoEn`, `valorNuevo`.

---

## 3. Verificar auditoría del comité (API)

```bash
curl "http://localhost:5005/api/admin/audit-logs?acciones=COMITE_CREADO,COMITE_INTEGRANTE_CREADO&pageSize=5" \
  -b cookies.txt
```

**Esperado**: `200` con registros cuyo `accion` empiece por `COMITE_`.

---

## 4. Filtrar por usuario (búsqueda parcial)

```bash
curl "http://localhost:5005/api/admin/audit-logs?acciones=OPERADOR_CREADO&q=admin" \
  -b cookies.txt
```

**Esperado**: `200` con registros cuyo usuario tenga `nombre` o `email` que contengan "admin".

---

## 5. Filtrar por recursoId

Reemplazar `RECURSO_ID` por un ID real de la respuesta anterior:

```bash
curl "http://localhost:5005/api/admin/audit-logs?recursoId=RECURSO_ID" \
  -b cookies.txt
```

**Esperado**: `200` con registros cuyo `recursoId` coincida exactamente.

---

## 6. Verificar acceso denegado como PARENT

```bash
# Login como parent
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c parent.txt \
  -d '{"email":"parent@proteccion.local","password":"Parent123Test"}'

# Intentar consultar auditoría
curl "http://localhost:5005/api/admin/audit-logs?acciones=OPERADOR_CREADO" \
  -b parent.txt
```

**Esperado**: `403` con mensaje de permisos insuficientes.

---

## 7. Verificar UI en navegador

1. Abrir `http://localhost:5005/dashboard/admin/operadores/auditoria`.
2. Confirmar pestaña "Auditoría" en el submenú.
3. Confirmar tabla con acciones `OPERADOR_*` y filtros funcionales.
4. Abrir `http://localhost:5005/dashboard/admin/comite/auditoria`.
5. Confirmar tabla con acciones `COMITE_*`.

---

## 8. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests pasan, incluyendo `src/app/api/admin/audit-logs/route.test.ts`.

---

## 9. Verificar tipos y lint

```bash
npx tsc --noEmit
npm run lint
```

**Esperado**: Sin errores de TypeScript ni de ESLint.

---

## 10. Deploy limpio

```bash
./scripts/dev-restart.sh
```

**Esperado**: El script termina con el healthcheck exitoso y la app responde en `http://localhost:5005`.
