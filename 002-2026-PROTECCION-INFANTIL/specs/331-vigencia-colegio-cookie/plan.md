# Plan SPEC-331 · Vigencia cookie sesion_estado por rol

**Stack:** Next.js 14 App Router · TypeScript · Prisma · PostgreSQL
**Rama:** `work/pi-SPEC-331-vigencia-colegio-cookie`

## Análisis del problema

`buildSesionEstadoValue` llamaba `resolverEstadoVigencia(suscripcion)` para todos los roles.
SCHOOL_ADMIN/COMITE_CONVIVENCIA no tienen `Suscripcion` → retorna `SIN_SUSCRIPCION` → middleware 403.

## Decisión de diseño

Obtener `rol` via `findVigenciaCliente` (ya existente, en paralelo) sin modificar el contrato de `findDebeCambiarPassword` (test de integración con `toEqual` exacto lo protege).

## Archivos tocados

- `src/lib/routing/sesion-estado-emitter.ts` — lógica por rol
- `src/app/api/vigencia/refresh/route.ts` — eliminar duplicado
- `src/lib/routing/sesion-estado-emitter.test.ts` — tests unitarios
- `vitest.unit.includes.ts` — registro del test
- `specs/README.md` — fila SPEC-331
