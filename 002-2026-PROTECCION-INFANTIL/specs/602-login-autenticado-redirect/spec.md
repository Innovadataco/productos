# SPEC-602 · Redirect de pantallas de autenticación con sesión válida

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden del dueño (buena práctica estándar de industria): un usuario CON sesión activa que abre una ruta de sesión (`/login`, `/registro` y afines) debe ser redirigido automáticamente a su home, no ver el formulario. Rama `work/pi-SPEC-602-login-autenticado-redirect`.

## User story

Como usuario autenticado, quiero que al abrir `/login` o `/registro` (rebote viejo, link compartido, refresh) el sistema me mande directo a mi home, porque ver el formulario de acceso con la sesión viva es confuso y ya fue un vivo (06-09, SPEC-588: el dueño aterrizó en `/login` tras el OAuth con la sesión creada).

## Impacto en arquitectura: no

El cambio vive en el Paso 1 del middleware (ya existente desde SPEC-588) y en `src/lib/routing/guardias.ts` (lista nueva `pantallasAuth` + helper `esPantallaAuth`). No hay contratos nuevos ni rutas nuevas; `homeParaRol` (fuente única SPEC-319) sigue siendo el destino.

## Alcance

- SPEC-588 hardcodeó la terna `/login`, `/registro`, `/registro/inicio` en `middleware.ts`. SPEC-602 la mueve a `GUARDIAS_ACCESO.pantallasAuth` (fuente única de rutas, SPEC-287) con matching EXACTO.
- El Paso 1 del middleware ahora evalúa `esPantallaAuth(pathname)` en vez de la comparación inline.
- La excepción `?mensaje=sesion` (loop-cap SPEC-572) se conserva intacta.

## Desviación respecto al brief (documentada)

El brief sugería usar `GUARDIAS_ACCESO.sesion` / `esRutaSesion(pathname)`. **No aplica**, y no es un detalle menor:

1. `GUARDIAS_ACCESO.sesion` son rutas de INFRAESTRUCTURA de la sesión — `/api/me`, `/api/sesion/al-dia`, `/cambiar-password`, `/api/auth/cambiar-password`, `/api/auth/logout`, `/consentimiento`, `/api/consentimiento`, `/api/vigencia/refresh` — que DEBEN seguir alcanzables con JWT válido. Redirigirlas con 307 rompería el logout, los muros de consentimiento y de cambio de password obligatorio, y el refresh de vigencia.
2. Ninguna de esas rutas es pública, así que la condición `esRutaPublica ∧ esRutaSesion` jamás dispararía: la implementación literal sería código muerto.

La intención del brief (pantallas de auth, "/login, /registro y afines") se cumple con la lista nueva `pantallasAuth`. Esta decisión queda registrada aquí y en el comentario de `guardias.ts`.

## Functional Requirements

- **FR-001**: El sistema DEBE redirigir (307) a `homeParaRol(rol)` toda request a una pantalla de auth (`GUARDIAS_ACCESO.pantallasAuth`) que llegue con JWT válido.
- **FR-002**: El sistema NO DEBE redirigir cuando el query param `mensaje=sesion` está presente (terminal del loop-cap SPEC-572).
- **FR-003**: El sistema NO DEBE redirigir rutas excluidas a propósito (matching exacto): `/registro/crear-clave/<token>`, `/recuperar`, `/registro-colegio`, `/registro-profesional` deben seguir alcanzables con sesión (candado SPEC-588).
- **FR-004**: Sin token o con JWT inválido, las pantallas de auth se sirven como públicas (comportamiento intacto).

## Criterios de aceptación

- [x] `middleware-auth-screens.candado.test.ts` en verde: 3 roles parametrizados en `/login` → 307 a su home; `/registro` y `/registro/inicio` con JWT → 307; `?mensaje=sesion` → next; sin token → next; crear-clave/recuperar/registro-colegio/registro-profesional con sesión → next.
- [x] Tests unitarios de `esPantallaAuth` (exacto, no prefijo; flujos de soporte fuera).
- [x] Gate completo verde (tsc, lint, test, build).
- [x] `guardia-invariante` y `arch:check` en verde.

## Implementación

- Modificados: `src/lib/routing/guardias.ts` (`pantallasAuth` + `esPantallaAuth`), `middleware.ts` (Paso 1 usa `esPantallaAuth`), `src/lib/routing/middleware-auth-screens.candado.test.ts` (casos SPEC-602), `src/lib/routing/guardias.test.ts` (unitarios del helper).

## Deuda técnica

Ninguna conocida. Si en el futuro nace otra pantalla de auth "pura" (ej. `/login-magico`), basta agregarla a `pantallasAuth` — el SPEC-422-style "descubrir en el disco" no se replicó aquí porque las pantallas de auth no siguen un prefijo único distinguible de los flujos de soporte.
