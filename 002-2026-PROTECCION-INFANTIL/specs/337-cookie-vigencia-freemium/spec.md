# SPEC-337 · Activar freemium re-sella `sesion_estado` (I-227) · 002-PI

**Status**: IMPLEMENTADO
**Radicado**: I-227 · clase cookie-stale (I-211 / I-222 / I-224) · Prioridad 🟠 (frenó a Jelkin)
**Impacto en arquitectura:** ninguno — nuevo helper `sellarCookieSesionEstado` que centraliza el patrón ya existente (login/consentimiento/vigencia-refresh) y se aplica en `activar-freemium`. Sin cambio de esquema.

## Problema (verificado en fuente)

El padre activa "Prueba gratis 30 días" → la suscripción queda **ACTIVA** en la BD (y en `/dashboard/padre/suscripcion`), pero **todos los módulos siguen bloqueados**; solo se abren tras "Renovar suscripción" (que recarga la página). Causa: `POST /api/padre/suscripcion/activar-freemium` crea la suscripción pero **NO re-emite la cookie firmada `sesion_estado`** que gatea el middleware (no llama `buildSesionEstadoValue`). La cookie sigue diciendo "sin vigencia" hasta que un refresh la re-sella. Es la clase I-211/I-222/I-224 (cookie stale).

## Enumeración de endpoints que cambian vigencia (candado 22v5)

Revisados TODOS los `route.ts` bajo `suscripcion`/`pagos`. Ninguno re-emitía `sesion_estado`. Clasificación por si el USUARIO AUTENTICADO cambia su PROPIA vigencia a activa (→ requiere re-sello inmediato):

| Endpoint | ¿re-sello? | Por qué |
|---|---|---|
| `padre/suscripcion/activar-freemium` | **SÍ (arreglado)** | self-activa → suscripción ACTIVA al instante; el padre está en la request |
| `padre/suscripcion/solicitar-plan` | No | crea `PENDIENTE_AUTORIZACION` (el admin autoriza); la vigencia no cambia aún |
| `colegio/suscripcion/solicitar-plan` | No | idem (PENDIENTE_AUTORIZACION) |
| `pagos/renovacion` | No | crea `PENDIENTE_AUTORIZACION` (autoriza el admin, SPEC-212) |
| `pagos/aplicar-bono`, `pagos/aplicar-referido` | No | modifican una suscripción existente/pendiente; no activan a un usuario bloqueado |
| `pagos/suscripcion/cancelar` | **SÍ (arreglado)** | el usuario cancela su propia suscripción (→ CANCELADA); re-sellar corta el acceso al INSTANTE (decisión del CEO: sin "acceso extra breve") |
| `admin/pagos/*` (activar-manual, extender, autorizar…) | No aplica | cambian la vigencia de OTRO usuario; no se puede sellar la cookie de otro en la respuesta del admin → lo resuelve el próximo `session/ping`/`vigencia/refresh` del usuario |

## Requisitos funcionales

- **FR-001** `sellarCookieSesionEstado(res, userId)` (nuevo helper) re-emite `sesion_estado` con las mismas opciones que login/consentimiento (httpOnly, sameSite lax, secure, maxAge=TTL, path /). Fallo silencioso (la cookie no bloquea la acción).
- **FR-002** `activar-freemium` llama al helper con `usuario.id` antes de devolver la respuesta 201 → los módulos abren al instante, sin refresh.
- **FR-003** El resto de endpoints de vigencia quedan enumerados (arriba); no requieren cambio (pendientes de autorización o cambian a otro usuario).

## Success Criteria

- **SC-001** Test (BD real): la respuesta de `activar-freemium` incluye `Set-Cookie: sesion_estado=`. Verificado local (4/4 verde).
- **SC-002** `verificaciones` + `specs-discipline` verdes.
- **SC-003** Evidencia navegador (activar prueba → módulos abren al instante) — la captura el CEO post-deploy.

## Nota (clase de bug recurrente)

Es la 4ª vez (I-211/222/224/227) que un endpoint olvida re-sellar `sesion_estado`. Por eso el fix es un **helper centralizado**, no otro bloque inline. Follow-up sugerido (fuera de scope): un ratchet/lint que exija el re-sello en endpoints que activan vigencia propia, o adoptar el helper en los 6 endpoints que hoy inlinean el patrón.
