# Quickstart: Validación de Seguridad Fase 1

**Prerequisites**: Docker, Node.js >=22, `npm` o `pnpm`, base de datos levantada y seed aplicado.

---

## 1. Iniciar PostgreSQL

```bash
docker compose up -d db
```

Verificar: `docker compose ps` muestra `db` en estado `healthy`.

---

## 2. Instalar dependencias y seed

```bash
npm install
npx prisma db seed   # Crea roles, admin por defecto, parámetros base
```

> No se requieren migraciones nuevas para esta fase.

---

## 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

Servidor en `http://localhost:5005`.

---

## 4. Validar escenarios end-to-end

### Escenario A: Rate limit en recuperación de contraseña

```bash
# Solicitar 6 veces para exceder el límite por defecto (5/hora por IP)
for i in 1 2 3 4 5 6; do
  curl -X POST http://localhost:5005/api/auth/recuperar/solicitar \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 203.0.113.10" \
    -d '{"email":"limite-recuperar@ejemplo.com"}'
  echo
done
```

**Esperado**: las primeras 5 respuestas retornan `200` con el mensaje uniforme. La 6ª retorna `429` con cabeceras `X-RateLimit-*` y `Retry-After`.

---

### Escenario B: Rate limit en solicitud de verificación

```bash
# Solicitar 6 veces para exceder el límite por defecto (5/hora por IP)
for i in 1 2 3 4 5 6; do
  curl -X POST http://localhost:5005/api/auth/verificar/solicitar \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 203.0.113.11" \
    -d '{"email":"limite-verificar@ejemplo.com"}'
  echo
done
```

**Esperado**: las primeras 5 respuestas retornan `202` con el mensaje uniforme. La 6ª retorna `429`.

---

### Escenario C: Rate limit por email (identificador)

```bash
# Cambiar la IP entre solicitudes pero mantener el mismo email
for ip in 203.0.113.20 203.0.113.21 203.0.113.22 203.0.113.23 203.0.113.24 203.0.113.25; do
  curl -X POST http://localhost:5005/api/auth/verificar/solicitar \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: $ip" \
    -d '{"email":"mismo-email@ejemplo.com"}'
  echo
done
```

**Esperado**: la 6ª solicitud retorna `429` aunque venga de IP diferente, porque el límite por email se excedió.

---

### Escenario D: Validación Zod en registro

```bash
# Email inválido
curl -X POST http://localhost:5005/api/auth/register \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt \
  -d '{"email":"no-es-email","password":"debil","rol":"PARENT"}'

# Contraseña débil
curl -X POST http://localhost:5005/api/auth/register \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt \
  -d '{"email":"nuevo@ejemplo.com","password":"12345678","rol":"PARENT"}'
```

**Esperado**: ambas respuestas retornan `400` con `error.code = VALIDATION_ERROR`.

---

### Escenario E: Validación Zod en recuperar/solicitar

```bash
curl -X POST http://localhost:5005/api/auth/recuperar/solicitar \
  -H "Content-Type: application/json" \
  -d '{"email":""}'
```

**Esperado**: `400` con `VALIDATION_ERROR`.

---

### Escenario F: Validación Zod en recuperar/restablecer

```bash
# Token vacío
curl -X POST http://localhost:5005/api/auth/recuperar/restablecer \
  -H "Content-Type: application/json" \
  -d '{"token":"","password":"NuevaPass123"}'

# Contraseña débil
curl -X POST http://localhost:5005/api/auth/recuperar/restablecer \
  -H "Content-Type: application/json" \
  -d '{"token":"token-valido","password":"corta"}'
```

**Esperado**: ambas respuestas retornan `400` con `VALIDATION_ERROR`.

---

### Escenario G: Respuesta uniforme sin enumeración

```bash
# Email no registrado
curl -X POST http://localhost:5005/api/auth/recuperar/solicitar \
  -H "Content-Type: application/json" \
  -d '{"email":"no-registrado@ejemplo.com"}'

# Email registrado (usar admin@proteccion.local)
curl -X POST http://localhost:5005/api/auth/recuperar/solicitar \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@proteccion.local"}'
```

**Esperado**: ambas respuestas retornan `200` con el mismo mensaje: "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.".

---

## 5. Ejecutar tests

```bash
npm run test
```

**Meta**: Todos los tests pasan, incluyendo `src/lib/validators.test.ts`, `src/app/api/auth/recuperar/solicitar/route.test.ts` y `src/app/api/auth/verificar/solicitar/route.test.ts`.

---

## 6. Verificar build y lint

```bash
npm run lint
npm run build
```

**Esperado**: `lint` sin errores y `build` compila exitosamente.

---

## 7. Plan de borrado seguro (US3)

Revisar `specs/045-seguridad-fase-1/plan.md` sección "Plan de Borrado Seguro / Derecho al Olvido". No se implementa código; se valida que el plan esté completo.
