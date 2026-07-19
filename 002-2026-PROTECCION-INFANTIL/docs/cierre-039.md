# Cierre — Spec 039: Middleware perimetral real

## Resumen

Se verificó y consolidó el guard perimetral real para Next.js 16.2.10. La convención correcta en esta versión es `src/proxy.ts` exportando una función `proxy` y un objeto `config` con `matcher`, no `src/middleware.ts` con export `middleware`. El build lo confirmó: con `src/middleware.ts` presente, Next.js arrojaba `middleware file convention deprecated; please use proxy instead`. Con `src/proxy.ts` como entrypoint, el arranque muestra `"ƒ Proxy (Middleware)"` y las redirecciones/autorizaciones funcionan antes de llegar a handlers o layouts.

## Ajuste respecto al plan aprobado

- El plan original proponía crear `src/middleware.ts` con export `middleware` y luego eliminar `src/proxy.ts`.
- El build mostró que Next.js 16.2.10 deprecó esa convención y exige `src/proxy.ts` con export `proxy`.
- Se mantuvo `src/proxy.ts` como entrypoint y `src/lib/proxy.ts` como helper de lógica edge-safe. No se eliminó `src/proxy.ts`; es el punto de entrada requerido por el framework.
- `src/middleware.ts` no existe y no se crea.

## Archivos afectados

- `src/proxy.ts` — entrypoint de convención Next.js 16.
- `src/lib/proxy.ts` — lógica edge-safe de autenticación y autorización perimetral.
- Artefactos Spec-Kit actualizados: `specs/039-middleware-perimetral-real/spec.md`, `research.md`, `plan.md`, `tasks.md`, `quickstart.md`, `checklists/requirements.md`.
- `docs/cierre-039.md` (este archivo).

## Validación

### Build y tests

- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning preexistente en `src/app/dashboard/admin/comite/gestion/page.tsx`).
- `npm run test`: 79 test files, 419 tests, todos pasan.
- `rm -rf .next && npm run build`: OK; en el arranque se observa `"ƒ Proxy (Middleware)"`.
- `./scripts/dev-restart.sh`: OK, healthcheck de worker OK, un solo worker corriendo.

### Pruebas de roles (curl)

Usuarios de prueba creados (todos con contraseña `TempPass123!`):

- `admin-039@example.com` (ADMIN)
- `school-admin-039@example.com` (SCHOOL_ADMIN)
- `operador-039@example.com` (OPERADOR)
- `comite-039@example.com` (COMITE_VALIDACION)
- `parent-039@example.com` (PARENT)

Resultados:

```text
=== 1. Sin sesión ===
[anon /dashboard/admin -> login] 307 http://localhost:5005/login
[anon /api/admin/nonexistent -> 401] 401
anon /api/admin/nonexistent body: {"error":{"message":"No autenticado"}}
anon POST /api/reportes body: {"error":{"message":"Datos inválidos","code":"VALIDATION_ERROR",...}}

=== 2. ADMIN ===
[admin /dashboard/admin] 200
[admin /mis-reportes -> admin home] 307 http://localhost:5005/dashboard/admin
[admin /dashboard/circulo-confianza -> admin home] 307 http://localhost:5005/dashboard/admin

=== 3. SCHOOL_ADMIN ===
[school /dashboard/admin] 200
[school /mis-reportes -> admin home] 307 http://localhost:5005/dashboard/admin

=== 4. OPERADOR ===
[operador /dashboard/admin] 200
[operador /mis-reportes -> admin home] 307 http://localhost:5005/dashboard/admin

=== 5. COMITE_VALIDACION ===
[comite /dashboard/admin] 200
[comite /dashboard/admin/comite] 200
[comite /mis-reportes -> comite home] 307 http://localhost:5005/dashboard/admin/comite
[comite /dashboard/circulo-confianza -> comite home] 307 http://localhost:5005/dashboard/admin/comite

=== 6. PARENT ===
[parent /dashboard] 200
[parent /mis-reportes] 200
[parent /dashboard/admin -> /] 307 http://localhost:5005/
[parent /api/admin/reportes -> 403] HTTP 403
```

### Interpretación

- Sin sesión: el proxy intercepta `/dashboard/admin` y `/api/admin/*` y redirige/responde antes de que lleguen a handlers/layouts.
- ADMIN, SCHOOL_ADMIN y OPERADOR acceden a `/dashboard/admin` y son redirigidos desde rutas PARENT.
- COMITE_VALIDACION accede a `/dashboard/admin` y `/dashboard/admin/comite`, y es redirigido a `/dashboard/admin/comite` desde rutas PARENT.
- PARENT accede a `/dashboard` y `/mis-reportes`, y es redirigido desde `/dashboard/admin`.
- Ruta pública API anónima (`POST /api/reportes`) no es bloqueada por el proxy; el error es de validación de negocio, no de autenticación.

## Commits y push

- `docs(039): ajusta spec-kit a convención proxy.ts de Next.js 16` — actualiza research.md, plan.md, tasks.md, spec.md, quickstart.md, checklist.
- `docs(039): cierre-039 y evidencia de pruebas` — añade `docs/cierre-039.md`.
- Push a `feature/001-scaffolding`.

## Deuda técnica

- Ninguna nueva. El proxy perimetral está operativo y los 5 roles pasan sus pruebas.
- Posible mejora futura: agregar un logger estructurado para eventos de rechazo del proxy (hoy usa respuestas HTTP estándar).

## Estado del deploy

- App corriendo en `:5005` con `-H 0.0.0.0`.
- Un solo worker activo.
- Healthcheck del worker OK.
- No hay roles bloqueados ni lockout.
