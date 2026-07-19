# Quickstart — Spec 039: Middleware perimetral real

## Prerrequisitos

- Repo en rama `feature/001-scaffolding`.
- Dependencias instaladas: `npm install`.
- App construida con `rm -rf .next && npm run build`.
- `./scripts/dev-restart.sh` ejecutado (un solo worker).
- Tener o crear usuarios de cada rol: ADMIN, SCHOOL_ADMIN, OPERADOR, COMITE_VALIDACION, PARENT.

> Nota: Next.js 16.2.10 deprecó el archivo `src/middleware.ts` y la función `middleware`. La convención correcta en este proyecto es `src/proxy.ts` con export `proxy` y `config`. El build debe mostrar `"ƒ Proxy (Middleware)"`.

## Verificación de que el proxy realmente corre

1. Sin iniciar sesión, acceder a `/dashboard/admin`:

   ```bash
   curl -s -I http://localhost:5005/dashboard/admin
   ```

   Esperado: `HTTP/1.1 307 Temporary Redirect` con `location: /login`.
   El redirect debe provenir del proxy, no solo del layout admin.

2. Sin iniciar sesión, llamar a un endpoint admin:

   ```bash
   curl -s http://localhost:5005/api/admin/nonexistent-route
   ```

   Esperado: `{ "error": { "message": "No autenticado" } }` con HTTP 401.

3. Acceder a una ruta pública sin sesión:

   ```bash
   curl -s -I http://localhost:5005/consulta?identificador=test
   ```

   Esperado: HTTP 200 (no redirección).

4. Verificar que `POST /api/reportes` anónimo no es bloqueado por el proxy (puede devolver 400 por validación de negocio, pero no 401/403):

   ```bash
   curl -s -X POST http://localhost:5005/api/reportes \
     -H 'Content-Type: application/json' \
     -d '{"tipo":"violencia","descripcion":"prueba"}'
   ```

## Prueba de los 5 roles

Crear cookies de sesión para cada rol (login) y probar:

1. ADMIN / SCHOOL_ADMIN
   - `GET /dashboard/admin` -> HTTP 200
   - `GET /mis-reportes` -> redirect a `/dashboard/admin`
   - `GET /dashboard/circulo-confianza` -> redirect a `/dashboard/admin`

2. OPERADOR
   - `GET /dashboard/admin` -> HTTP 200
   - `GET /mis-reportes` -> redirect a `/dashboard/admin`

3. COMITE_VALIDACION
   - `GET /dashboard/admin/comite` -> HTTP 200
   - `GET /dashboard/admin` -> HTTP 200 (o redirect a `/dashboard/admin/comite` si el layout lo decide)
   - `GET /mis-reportes` -> redirect a `/dashboard/admin/comite`
   - `GET /dashboard/circulo-confianza` -> redirect a `/dashboard/admin/comite`

4. PARENT
   - `GET /mis-reportes` -> HTTP 200
   - `GET /dashboard` -> HTTP 200
   - `GET /dashboard/admin` -> redirect a `/`
   - `GET /api/admin/reportes` -> HTTP 403

5. Sin sesión
   - `GET /dashboard/admin` -> redirect a `/login`
   - `GET /api/admin/nonexistent-route` -> 401

## Script de prueba rápida (opcional)

```bash
#!/usr/bin/env bash
BASE="http://localhost:5005"
PASS='TempPass123!'
login() { rm -f "$2"; curl -s -c "$2" -b "$2" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" -o /dev/null; }
for r in admin@proteccion.local school-admin-039@example.com operador-039@example.com comite-039@example.com parent-039@example.com; do
  login "$r" "/tmp/c-${r%%@*}.txt"
  echo "--- $r /dashboard/admin ---"
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -I -b "/tmp/c-${r%%@*}.txt" "$BASE/dashboard/admin"
done
echo "--- anon /dashboard/admin ---"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -I "$BASE/dashboard/admin"
```

## Validación automática

```bash
npm run lint
npx tsc --noEmit
npm run test
```

## Limpieza y reinicio

```bash
rm -rf .next
npm run build
./scripts/dev-restart.sh
```
