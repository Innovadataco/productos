# Quickstart: Validación de Autenticación y Configuración

**Prerequisites**: Docker, Node.js >=22, `npm` or `pnpm`

---

## 1. Iniciar PostgreSQL

```bash
docker compose up -d db
```

Verificar: `docker compose ps` muestra `db` en estado `healthy`.

---

## 2. Instalar dependencias y migrar

```bash
npm install
npx prisma migrate dev --name init
npx prisma db seed   # Crea roles, admin por defecto, parámetros base
```

---

## 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

Servidor en `http://localhost:3000`.

---

## 4. Validar escenarios end-to-end

### Escenario A: Login como ADMIN

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'
```

**Esperado**: `200` con `{ user: { rol: "ADMIN" } }`, cookie `token` establecida.

---

### Escenario B: Leer parámetros públicos (sin auth)

```bash
curl http://localhost:3000/api/config/parametros/publicos
```

**Esperado**: `200` con `visibility.report_threshold` y `system.maintenance_mode`.

---

### Escenario C: Modificar umbral como ADMIN

```bash
curl -X PATCH http://localhost:3000/api/config/parametros/visibility.report_threshold \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"valor":"5","motivo":"Prueba de ajuste"}'
```

**Esperado**: `200` con valor actualizado. Verificar en `publicos` que refleja el cambio.

---

### Escenario D: Acceso denegado como PARENT

```bash
# 1. Login como parent
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c parent.txt \
  -d '{"email":"parent@proteccion.local","password":"Parent123!Test"}'

# 2. Intentar modificar parámetro
curl -X PATCH http://localhost:3000/api/config/parametros/visibility.report_threshold \
  -H "Content-Type: application/json" \
  -b parent.txt \
  -d '{"valor":"10"}'
```

**Esperado**: `403` — permisos insuficientes.

---

### Escenario E: Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

**Esperado**: `200`, cookie `token` eliminada.

---

## 5. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests de autenticación, configuración y utilidades pasan.

---

## 6. Verificar build

```bash
npm run build
```

**Esperado**: Compila sin errores de TypeScript.