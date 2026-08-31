# SPEC-331 · Hotfix vigencia cookie sesion_estado — derivación por rol

**Status:** `EN_DESARROLLO`
**Prioridad:** 🔴 CRÍTICA (prod — SCHOOL_ADMIN bloqueado)
**Instructivo:** INSTRUCTIVO-002-PI-231-VIGENCIA-COLEGIO-COOKIE-SESION.md
**Impacto en arquitectura:** `buildSesionEstadoValue` en `sesion-estado-emitter.ts` ahora resuelve vigencia por rol: SCHOOL_ADMIN/COMITE_CONVIVENCIA usan `verificarVigenciaCliente` mapeado a `EstadoVigenciaEfectivo`; PARENT mantiene flujo de suscripción; internos siempre ACTIVA. `vigencia/refresh/route.ts` eliminó duplicado, delega en el emitter.

## Problema

La cookie `sesion_estado` derivaba la vigencia siempre desde `resolverEstadoVigencia(suscripcion)`. Los SCHOOL_ADMIN no tienen fila `Suscripcion` → la función devuelve `SIN_SUSCRIPCION` → el middleware de paso 6 los expulsa con 403 `VIGENCIA_REQUERIDA`.

## Solución

Resolver vigencia por rol en `buildSesionEstadoValue`:
- `SCHOOL_ADMIN` / `COMITE_CONVIVENCIA` → `verificarVigenciaCliente(userId)` → `vigente ? ACTIVA : SUSPENDIDA`
- `ADMIN` / `OPERADOR` / `COMITE_VALIDACION` → siempre `ACTIVA`
- `PARENT` → `resolverEstadoVigencia(suscripcion)` (sin cambios)

Archivos modificados:
- `src/lib/dal/repositories/usuario.ts` — `findDebeCambiarPassword` agrega `rol` al select
- `src/lib/routing/sesion-estado-emitter.ts` — resolver por rol
- `src/app/api/vigencia/refresh/route.ts` — elimina duplicado, llama a `buildSesionEstadoValue`
- `src/lib/routing/sesion-estado-emitter.test.ts` — tests por rol (SPEC-331)
- `vitest.unit.includes.ts` — registra el nuevo test
