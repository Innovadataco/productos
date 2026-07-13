# Quickstart: Validación de Autenticación y Configuración

**Prerequisites**: Docker, Node.js >=22, `npm` or `pnpm`, `RESEND_API_KEY` en `.env`

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

Servidor en `http://localhost:5005`.

---

## 4. Validar escenarios end-to-end

### Escenario A: Registro completo con código de verificación

```bash
# 1. Solicitar código
curl -X POST http://localhost:5005/api/auth/verificar/solicitar \
  -H "Content-Type: application/json" \
  -d '{"email":"nuevo@ejemplo.com"}'

# 2. Verificar código (reemplazar CODIGO con el recibido por email)
curl -X POST http://localhost:5005/api/auth/verificar/validar \
  -H "Content-Type: application/json" \
  -d '{"email":"nuevo@ejemplo.com","codigo":"123456"}'
# Esperado: 200 con { valido: true, token: "..." }

# 3. Completar registro con contraseña
curl -X POST http://localhost:5005/api/auth/verificar/completar \
  -H "Content-Type: application/json" \
  -d '{"token":"TEMP_JWT_DEL_PASO_2","password":"segura123","nombre":"Juan Pérez"}'
# Esperado: 201 con { user: { rol: "PARENT" } } y cookie token
```

**Esperado**: Cuenta creada con rol PARENT, email verificado, sesión activa.

---

### Escenario B: Login como ADMIN

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@proteccion.local","password":"Admin123!Secure"}'
```

**Esperado**: `200` con `{ user: { rol: "ADMIN" } }`, cookie `token` establecida.

---

### Escenario C: Leer parámetros públicos (sin auth)

```bash
curl http://localhost:5005/api/config/parametros/publicos
```

**Esperado**: `200` con `visibility.report_threshold` y `system.maintenance_mode`.

---

### Escenario D: Modificar umbral como ADMIN

```bash
curl -X PATCH http://localhost:5005/api/config/parametros/visibility.report_threshold \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"valor":"5","motivo":"Prueba de ajuste"}'
```

**Esperado**: `200` con valor actualizado. Verificar en `publicos` que refleja el cambio.

---

### Escenario E: Acceso denegado como PARENT

```bash
# 1. Login como parent
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c parent.txt \
  -d '{"email":"parent@proteccion.local","password":"Parent123Test"}'

# 2. Intentar modificar parámetro
curl -X PATCH http://localhost:5005/api/config/parametros/visibility.report_threshold \
  -H "Content-Type: application/json" \
  -b parent.txt \
  -d '{"valor":"10"}'
```

**Esperado**: `403` — permisos insuficientes.

---

### Escenario F: Límite de códigos excedido

```bash
# Solicitar 4 códigos en menos de 1 hora
for i in 1 2 3 4; do
  curl -X POST http://localhost:5005/api/auth/verificar/solicitar \
    -H "Content-Type: application/json" \
    -d '{"email":"limite@ejemplo.com"}'
done
```

**Esperado**: La 4ª solicitud retorna `429`.

---

### Escenario G: Logout

```bash
curl -X POST http://localhost:5005/api/auth/logout -b cookies.txt
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