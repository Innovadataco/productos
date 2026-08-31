# SPEC-331 · Hotfix vigencia cookie sesion_estado — derivación por rol

**Status**: DESARROLLO
**Prioridad:** 🔴 CRÍTICA (prod — SCHOOL_ADMIN bloqueado con 403 VIGENCIA_REQUERIDA)
**Instructivo:** INSTRUCTIVO-002-PI-231-VIGENCIA-COLEGIO-COOKIE-SESION.md
**Impacto en arquitectura:** `buildSesionEstadoValue` en `sesion-estado-emitter.ts` ahora resuelve vigencia por rol: SCHOOL_ADMIN/COMITE_CONVIVENCIA usan `verificarVigenciaCliente` mapeado a `EstadoVigenciaEfectivo`; PARENT mantiene flujo de suscripción; roles internos siempre ACTIVA. `vigencia/refresh/route.ts` eliminó duplicado, delega en el emitter. `findVigenciaCliente` agregado al batch paralelo para obtener rol sin romper el contrato de `findDebeCambiarPassword`.

## Problema (I-224)

La cookie `sesion_estado` derivaba la vigencia siempre desde `resolverEstadoVigencia(suscripcion)`. Los SCHOOL_ADMIN no tienen fila `Suscripcion` → la función devuelve `SIN_SUSCRIPCION` → el middleware de paso 6 los expulsa con 403 `VIGENCIA_REQUERIDA`. Panel de colegio inaccesible.

## Solución

Resolver vigencia por rol en `buildSesionEstadoValue`:

- `SCHOOL_ADMIN` / `COMITE_CONVIVENCIA` → `verificarVigenciaCliente(userId)` → `vigente ? ACTIVA : SUSPENDIDA`
- `ADMIN` / `OPERADOR` / `COMITE_VALIDACION` → siempre `ACTIVA`
- `PARENT` → `resolverEstadoVigencia(suscripcion)` (sin cambios)

`rol` se obtiene via `findVigenciaCliente` (paralelo) — `findDebeCambiarPassword` conserva su select mínimo.

## Archivos modificados

- `src/lib/routing/sesion-estado-emitter.ts` — resolver por rol + `findVigenciaCliente` al batch
- `src/app/api/vigencia/refresh/route.ts` — elimina duplicado, delega en `buildSesionEstadoValue`
- `src/lib/routing/sesion-estado-emitter.test.ts` — 12 tests por rol

## Sin migración de BD. Sin nuevos endpoints.
