# Quickstart: Consentimiento informado (SPEC-241)

**Prerequisites**: Docker, Node.js >=22, `.env` con `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`.

---

## 1. Base de datos y seed

```bash
docker compose up -d db
npx prisma@5.22.0 migrate dev
npx prisma@5.22.0 db seed
```

Verificar que existen los parámetros:

```bash
psql "$DATABASE_URL" -c 'SELECT clave, valor FROM "ParametroSistema" WHERE clave LIKE '\''consentimiento.%'\'';'
```

Esperado:

```text
consentimiento.version_actual            | v0.4
consentimiento.padre.documento_ruta      | public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md
consentimiento.colegio.documento_ruta    | public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md
```

---

## 2. Iniciar servidor de desarrollo

```bash
npm run dev
```

Servidor en `http://localhost:5005`.

---

## 3. Escenario A: padre redirigido y acepta consentimiento

### 3.1 Crear o usar cuenta PARENT

Si aún no tienes una, regístrala vía `/api/auth/verificar/...` o crea un usuario de prueba.

### 3.2 Login

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"padre@ejemplo.com","password":"TestPass123"}'
```

### 3.3 Intentar acceder al dashboard sin consentimiento

```bash
curl -I http://localhost:5005/dashboard/padre/suscripcion -b cookies.txt
```

**Esperado**: redirección `307` a `/consentimiento`.

### 3.4 Aceptar consentimiento

```bash
curl -X POST http://localhost:5005/api/consentimiento/aceptar \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"documentoTipo":"POLITICA_DATOS","esRepresentanteLegal":true}'
```

**Esperado**: `201` con `ok: true` y `version: "v0.4"`.

### 3.5 Verificar traza en BD

```bash
psql "$DATABASE_URL" -c '
SELECT u.email, u."consentimientoVersion", ac.version, ac."documentoTipo", ac."documentoHash", ac.ip
FROM "Usuario" u
JOIN "audit_consentimientos" ac ON ac."usuarioId" = u.id
WHERE u.email = '\''padre@ejemplo.com'\'';'
```

**Esperado**: una fila con `version = v0.4`, `documentoTipo = POLITICA_DATOS`, hash SHA256 no nulo.

### 3.6 Acceder al dashboard tras aceptar

```bash
curl -I http://localhost:5005/dashboard/padre/suscripcion -b cookies.txt
```

**Esperado**: ya no redirige a `/consentimiento`.

---

## 4. Escenario B: forzar re-aceptación al cambiar versión

```bash
psql "$DATABASE_URL" -c '
UPDATE "ParametroSistema" SET valor = '\''v0.5'\'' WHERE clave = '\''consentimiento.version_actual'\'';'
```

Repetir el paso 3.3:

```bash
curl -I http://localhost:5005/dashboard/padre/suscripcion -b cookies.txt
```

**Esperado**: redirección a `/consentimiento` de nuevo.

Volver a aceptar (paso 3.4). La BD ahora tendrá dos filas en `audit_consentimientos`: `v0.4` y `v0.5`.

---

## 5. Escenario C: SCHOOL_ADMIN acepta convenio institucional

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -c colegio.txt \
  -d '{"email":"rector@colegio.com","password":"TestPass123"}'

curl -X POST http://localhost:5005/api/consentimiento/aceptar \
  -H "Content-Type: application/json" \
  -b colegio.txt \
  -d '{"documentoTipo":"CONVENIO_INSTITUCIONAL","esRepresentanteLegal":true}'
```

**Esperado**: `201` con `documentoTipo = CONVENIO_INSTITUCIONAL`.

---

## 6. Ejecutar tests

```bash
# Unitarios (componente ModalConsentimiento)
npm run test:unit -- src/components/modules/ModalConsentimiento.test.tsx

# Integración: endpoint + guardia + página
npm run test:integration -- src/app/api/consentimiento/aceptar/route.test.ts
npm run test:integration -- src/lib/consentimiento/guard.test.ts
npm run test:integration -- src/app/consentimiento/page.test.tsx
```

---

## 7. Verificar build

```bash
rm -rf .next
npm run build
```

**Esperado**: build limpio sin errores de TypeScript ni de ESLint.

---

## 8. Reinicio limpio de desarrollo

```bash
./scripts/dev-restart.sh
```

Esto levanta app + un worker; la guardia de consentimiento debe activarse en los layouts de dashboard.
