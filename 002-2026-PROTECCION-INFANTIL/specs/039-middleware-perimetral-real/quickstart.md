# Quickstart — Spec 039: Middleware perimetral real

## Prerrequisitos

- Repo en rama `feature/001-scaffolding`.
- Dependencias instaladas: `npm install`.
- App construida con `rm -rf .next && npm run build`.
- `./scripts/dev-restart.sh` ejecutado (un solo worker).
- Tener o crear usuarios de cada rol: ADMIN, SCHOOL_ADMIN, OPERADOR, COMITE_VALIDACION, PARENT.

## Verificación de que el middleware realmente corre

1. Sin iniciar sesión, acceder a `/dashboard/admin`:

   curl -s -I http://localhost:5005/dashboard/admin

   Esperado: HTTP/1.1 307 Temporary Redirect con location: /login.
   El redirect debe provenir del middleware, no solo del layout. Para confirmarlo, se puede agregar temporalmente un header en el middleware (p. ej. X-Middleware-Executed) y verificar que aparece en la respuesta; ese header no debe quedar en producción.

2. Sin iniciar sesión, llamar a un endpoint admin:

   curl -s http://localhost:5005/api/admin/reportes-revision

   Esperado: { "error": { "message": "No autenticado" } } con HTTP 401.

3. Acceder a una ruta pública sin sesión:

   curl -s -I http://localhost:5005/consulta?identificador=test

   Esperado: HTTP 200 (no redirección).

## Prueba de los 5 roles

Crear cookies de sesión para cada rol (login) y probar:

1. ADMIN / SCHOOL_ADMIN
   - GET /dashboard/admin -> HTTP 200
   - GET /mis-reportes -> redirect a /dashboard/admin

2. OPERADOR
   - GET /dashboard/admin -> HTTP 200
   - GET /mis-reportes -> redirect a /dashboard/admin

3. COMITE_VALIDACION
   - GET /dashboard/admin/comite -> HTTP 200
   - GET /dashboard/admin -> redirect a /dashboard/admin/comite (o 200 si el layout permite)
   - GET /mis-reportes -> redirect a /dashboard/admin/comite

4. PARENT
   - GET /mis-reportes -> HTTP 200
   - GET /dashboard/admin -> redirect a /mis-reportes o /

5. Sin sesión
   - GET /dashboard/admin -> redirect a /login
   - GET /api/admin/reportes-revision -> 401

## Validación automática

    npm run lint
    npx tsc --noEmit
    npm run test

## Limpieza y reinicio

    rm -rf .next
    npm run build
    ./scripts/dev-restart.sh
