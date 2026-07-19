# Data Model — Spec 039: Middleware perimetral real

## Cambios en el modelo de datos

No se requieren cambios en el modelo de datos de Prisma para este spec. El middleware opera sobre cookies y JWT, sin acceso a base de datos.

## Entidades involucradas (solo lectura)

- **Usuario**: el JWT contiene `sub` (id) y `rol`. El middleware lee el rol del token; no consulta la base de datos.
- **RolUsuario**: enum `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`.

## Archivos de código

- `src/middleware.ts` (nuevo entrypoint de Next.js middleware)
- `src/lib/proxy.ts` (helper compartido, refactorizado si es necesario)
- `src/proxy.ts` (a eliminar para consolidar)

## Notas

- El middleware no modifica datos; solo redirige o permite el paso.
- `verifyAuth` en layouts y endpoints seguirá verificando el token contra la base de datos como defensa en profundidad.
