# Feature Specification: Puente de sesión PI→BI (endpoint /api/auth/link-bi)

**Feature Branch**: `work/pi-SPEC-310-puente-sesion-bi-link`

**Created**: 2026-08-29

**Status**: PLANEADO

**Input**: User description: "Puente sesión PI↔BI (SPEC-310 · 002-PI-211). Cierra I-30 (parte PI). La cookie de PI (__Host-token) no puede cruzar a bi.innovadataco.com por el prefijo __Host-. Decisión CEO (Opción C): handoff con JWT ephemeral one-shot. Nuevo endpoint GET /api/auth/link-bi que valida la sesión PI actual, genera un JWT efímero (TTL 60s, claim linkTo:bi) firmado con JWT_SECRET, y redirige 302 a BI. Sin sesión PI, redirige a /login encadenando el returnTo. La parte BI (endpoint /api/auth/link + guard) la construye Fábrica BI-2 en paralelo."

**Impacto en arquitectura:** Agrega una única ruta API nueva (`GET /api/auth/link-bi`) que no persiste nada y no toca el modelo de datos. Reutiliza `verifyAuth()` (helper de sesión existente, sin modificarlo) y la librería `jose` ya presente en el proyecto (no `jsonwebtoken`, que no está instalado — ver Assumptions). Agrega la variable de entorno `BI_BASE_URL` a `.env.example`. Cero cambios en `src/lib/auth.ts`, en el flujo `POST /api/auth/login`, en `logout`, ni en la cookie `__Host-token`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un usuario con sesión PI activa entra a BI sin volver a loguearse (Priority: P1)

Un PADRE, SCHOOL_ADMIN o ADMIN que ya inició sesión en `pi.innovadataco.com` abre `bi.innovadataco.com/dashboard`. El guard de BI (fuera de este SPEC) lo redirige a `pi.innovadataco.com/api/auth/link-bi?returnTo=...`. Como su sesión PI sigue activa, el sistema debe generar un pase de un solo uso hacia BI sin pedirle credenciales de nuevo.

**Why this priority**: Es el corazón del puente — sin esto, ningún usuario con sesión PI válida puede llegar a BI, que es exactamente el bloqueador que cierra I-30.

**Independent Test**: Con una cookie `__Host-token` válida en la petición, llamar `GET /api/auth/link-bi?returnTo=https://bi.innovadataco.com/dashboard` y verificar que la respuesta es un 302 hacia `${BI_BASE_URL}/api/auth/link?token=...&returnTo=...`, con un JWT cuyo payload decodificado trae `sub`, `email`, `roles` (array) y `linkTo: "bi"`.

**Acceptance Scenarios**:

1. **Given** una sesión PI válida (cookie `__Host-token` verificable) y un `returnTo` en la whitelist, **When** se llama `GET /api/auth/link-bi?returnTo=<url>`, **Then** la respuesta es 302 hacia `${BI_BASE_URL}/api/auth/link?token=<JWT>&returnTo=<url>`.
2. **Given** ese mismo caso, **When** se decodifica el JWT del query param `token`, **Then** el payload contiene `sub` (id del usuario), `email`, `roles` (arreglo con el rol actual), `linkTo: "bi"`, y expira en 60 segundos desde su emisión (±5s de tolerancia).

---

### User Story 2 - Un usuario sin sesión PI activa es enviado a loguearse antes de continuar hacia BI (Priority: P1)

Un usuario abre el enlace de puente sin tener sesión PI vigente (cookie ausente, inválida o expirada). El sistema debe mandarlo a loguearse en PI primero, sin perder la intención de terminar en BI.

**Why this priority**: Sin este camino, un usuario deslogueado que llega desde BI se queda sin ruta de recuperación — rompe el flujo SSO-like completo descrito en el brief.

**Independent Test**: Llamar `GET /api/auth/link-bi?returnTo=<url>` sin cookie de sesión (o con una cookie inválida/expirada) y verificar 302 hacia `/login?returnTo=/api/auth/link-bi?returnTo=<url>`.

**Acceptance Scenarios**:

1. **Given** ninguna cookie de sesión PI presente, **When** se llama el endpoint, **Then** responde 302 hacia `/login?returnTo=/api/auth/link-bi?returnTo=<url original>` (encadena el retorno para que, tras loguearse, el usuario vuelva automáticamente al puente).
2. **Given** una cookie de sesión PI presente pero con JWT inválido o expirado, **When** se llama el endpoint, **Then** el comportamiento es idéntico al caso sin cookie (302 a `/login?returnTo=...`).

---

### User Story 3 - El sistema rechaza cualquier intento de usar el puente para redirigir a un destino fuera de BI (Priority: P1)

Un `returnTo` manipulado (host ajeno, esquema `javascript:`, URL protocol-relative como `//atacante.com`, o cualquier valor que no apunte a un host de BI conocido) no debe usarse tal cual para el redirect final.

**Why this priority**: Es la defensa contra open redirect — sin esto, el endpoint se vuelve una herramienta de phishing (el usuario confía en `pi.innovadataco.com` y termina en un sitio arbitrario con un JWT válido en la URL).

**Independent Test**: Llamar el endpoint (con sesión válida) pasando `returnTo` con hosts fuera de la whitelist, esquemas peligrosos, o URLs protocol-relative, y verificar que el `returnTo` efectivamente usado en el redirect es siempre el default seguro (`https://bi.innovadataco.com/dashboard`), nunca el valor recibido.

**Acceptance Scenarios**:

1. **Given** `returnTo=https://atacante.com/robar`, **When** se llama el endpoint con sesión válida, **Then** el redirect a BI usa el `returnTo` default, no el host ajeno.
2. **Given** `returnTo=javascript:alert(1)` o `returnTo=//atacante.com`, **When** se llama el endpoint con sesión válida, **Then** el redirect a BI usa el `returnTo` default.
3. **Given** `returnTo=https://bi.innovadataco.com/reportes` (host permitido, ruta interna cualquiera), **When** se llama el endpoint con sesión válida, **Then** el redirect a BI preserva ese `returnTo` tal cual.
4. **Given** `returnTo=http://localhost:3001/dashboard` (host de desarrollo permitido), **When** se llama el endpoint con sesión válida, **Then** el redirect a BI preserva ese `returnTo`.

---

### Edge Cases

- ¿Qué pasa si `returnTo` no viene en el query string? → Se usa el default (`https://bi.innovadataco.com/dashboard`), igual que un `returnTo` inválido.
- ¿Qué pasa si la sesión PI es válida pero el usuario fue desactivado (`estado !== "activo"`) entre que abrió la pestaña y llamó al endpoint? → Mismo camino que "sin sesión" (302 a `/login?returnTo=...`) — `verifyAuth()` ya lo rechaza.
- ¿Qué pasa si `JWT_SECRET` no está configurado en el entorno? → Falla al arrancar (mismo comportamiento que el resto de la app; `requireEnv` ya lo garantiza en otros puntos, no es responsabilidad de este endpoint).
- ¿Qué pasa si el usuario llama el endpoint dos veces seguidas con la misma sesión? → Cada llamada genera un JWT ephemeral nuevo e independiente (no hay estado de "ya usado" en PI; el consumo de un solo uso, si se implementa, vive del lado de BI — fuera de este SPEC).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/auth/link-bi` que reutiliza la verificación de sesión PI existente (`verifyAuth()`), sin reimplementar la lectura de cookie ni la verificación de JWT.
- **FR-002**: Cuando la sesión PI es válida, el sistema DEBE generar un JWT efímero firmado con `JWT_SECRET`, con claims `sub`, `email`, `roles` (arreglo), `linkTo: "bi"`, y expiración de 60 segundos desde su emisión.
- **FR-003**: Cuando la sesión PI es válida y el `returnTo` es válido, el sistema DEBE responder con un redirect 302 hacia `${BI_BASE_URL}/api/auth/link?token=<JWT>&returnTo=<returnTo validado>`.
- **FR-004**: Cuando la sesión PI NO es válida (cookie ausente, JWT inválido/expirado, o usuario inactivo), el sistema DEBE responder con un redirect 302 hacia `/login?returnTo=/api/auth/link-bi?returnTo=<returnTo original>` (encadenando el retorno).
- **FR-005**: El sistema DEBE validar `returnTo` contra una whitelist estricta de hosts permitidos (`bi.innovadataco.com` en producción, `localhost:3001` en desarrollo, ambos protocolos http/https para el caso de desarrollo) antes de usarlo en cualquier redirect.
- **FR-006**: Si `returnTo` no está presente, está malformado, o su host no está en la whitelist, el sistema DEBE usar un valor default seguro (`https://bi.innovadataco.com/dashboard`) en su lugar, nunca el valor recibido sin validar.
- **FR-007**: El sistema NO DEBE modificar la cookie `__Host-token`, el endpoint `POST /api/auth/login`, el endpoint `POST /api/auth/logout`, ni la lógica de verificación de JWT existente (`verifyToken`/`verifyAuth` en `src/lib/auth.ts`).
- **FR-008**: El sistema NO DEBE introducir la librería `jsonwebtoken` (no instalada en el proyecto); DEBE reutilizar `jose`, ya presente y usada por el resto de la autenticación PI.
- **FR-009**: El sistema DEBE documentar la variable de entorno `BI_BASE_URL` en `.env.example`.

### Key Entities *(include if feature involves data)*

- **JWT efímero de puente** (no persistido, no es una entidad de datos): estructura de claims `{ sub, email, roles, linkTo, iat, exp }`, vive solo en la URL de redirect durante su TTL de 60 segundos. No se guarda en ninguna tabla; PI no necesita recordar que lo emitió.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario con sesión PI activa que llega a `bi.innovadataco.com` sin sesión BI, completa el recorrido hasta el dashboard de BI sin volver a escribir su contraseña (verificable end-to-end una vez ambos lados — PI y BI — estén desplegados).
- **SC-002**: El 100% de los `returnTo` fuera de la whitelist terminan en el default seguro, nunca en el host recibido — verificable con los casos de la User Story 3.
- **SC-003**: Cero regresión: el flujo `POST /api/auth/login` existente y la cookie `__Host-token` se comportan exactamente igual antes y después de este cambio (verificable por diff: cero líneas tocadas en `login/route.ts`, `logout/route.ts`, `src/lib/auth.ts`).
- **SC-004**: Un JWT efímero capturado y reutilizado después de 60 segundos deja de ser válido (verificable por la expiración embebida en el propio token — la validación ocurre del lado de BI, fuera de este SPEC, pero el TTL corto es la garantía que PI ofrece).

## Assumptions

- **Corrección de biblioteca (verificado en fuente, no es HALLAZGO estructural)**: el brief/instructivo asumían `jsonwebtoken` para firmar el JWT efímero, pero ese paquete no está instalado — el proyecto usa `jose` en todo `src/lib/auth.ts`. Se usa `jose` (`SignJWT`) para mantener una sola librería de JWT en el codebase, consistente con D-72 (reutilizar módulos vivos).
- **Corrección de shape del payload (verificado en fuente)**: el brief/instructivo asumían que el token de sesión PI actual ya trae `{sub, email, roles}`. En realidad `createToken()` solo persiste `{sub, rol, sesionLogId}` (rol singular, sin email) — el email se resuelve desde la base de datos en cada request. El endpoint nuevo obtiene `email`/`rol` del objeto `user` que devuelve `verifyAuth()` (ya hace el lookup), y construye `roles` como arreglo de un solo elemento (`[user.rol]`) para igualar el shape plural que espera BI.
- El TTL de 60 segundos es intencionalmente corto (brief §5): si expira, el usuario simplemente reintenta el flujo desde BI, sin que eso sea un caso de error a manejar especialmente en PI.
- La whitelist de `returnTo` es una lista fija en código (no configurable por `ParametroSistema`) porque son 2 hosts conocidos y el cambio de infraestructura (agregar un dominio BI nuevo) requiere de por sí una revisión de código.
- No hay mecanismo de "un solo uso" (nonce/consumo) del lado de PI para el JWT efímero — la ventana de 60s más la validación de firma+expiración en BI es la superficie de defensa acordada en el brief; un nonce persistido sería sobre-ingeniería para este alcance (fuera de §6 del brief, Fase 2).
