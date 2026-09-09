# SPEC-603 · Sesión huérfana: JWT de usuario eliminado tumba /reportar (P2003) y /api/me en loop

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: bug verificado en producción (hotfix urgente). Rama `work/pi-SPEC-603-sesion-huerfana`.

## Bug (diagnóstico en prod)

Un navegador conserva un JWT con firma válida cuyo `sub` es un usuario **ya eliminado** de la BD (p. ej. tras una purga de datos):

1. `GET /reportar` **explota**: el layout (`src/app/reportar/layout.tsx`, SPEC-242) tomaba `payload.sub` del JWT sin verificar que el usuario existiera y auditaba `REPORTE_SIN_SUSCRIPCION` con ese `usuarioId` → `PrismaClientKnownRequestError P2003` (FK `AuditLog_usuarioId_fkey`) en medio del render del Server Component → la página pública se cae para ese navegador.
2. `GET /api/me` responde 401 **en loop**: `verifyAuth` ya devolvía 401, pero nadie expiraba la cookie huérfana, así que el navegador reintentaba con la misma cookie en cada carga.

El proxy (edge) no puede cortarlo: solo verifica la firma del JWT, que es válida.

## User story

Como visitante con una cookie de sesión huérfana (mi usuario fue eliminado), quiero que el servidor trate mi sesión como NO autenticada, para poder usar las páginas públicas (reportar, consultar) sin errores y volver a /login limpio.

## Fix (estándar de industria)

En el servidor, una sesión cuyo usuario no existe en BD se trata como **no autenticada**:

- **Páginas**: la sesión huérfana pasa como anónima (ruta pública) o redirige a /login (ruta protegida, comportamiento ya existente en los layouts que consultan repositorios).
- **`/api/**`**: responde 401 como ya hace `verifyAuth`.
- **Cookies**: la respuesta 401 de `/api/me` (route handler — es quien puede mutar cookies; un Server Component no) expira `__Host-token` y `token` con los mismos atributos que logout (Spec 106). El cliente consulta `/api/me` siempre, así que la cookie huérfana muere en el primer intento.

## Functional Requirements

- **FR-001**: El sistema DEBE resolver la sesión de Server Components contra la BD: JWT con `sub` inexistente o usuario inactivo ⇒ sesión null (equivalente a no tener token). Nunca se propaga un `sub` huérfano a consultas ni auditorías.
- **FR-002**: `GET /reportar` con sesión huérfana DEBE responder 200 renderizando como anónimo, sin escribir `AuditLog` con ese `usuarioId`.
- **FR-003**: `GET /api/me` con sesión huérfana DEBE responder 401 limpio (JSON `AppError`, sin stack) y expirar ambas cookies de sesión en la respuesta.
- **FR-004**: El comportamiento sano NO DEBE cambiar: usuario PARENT activo sin suscripción sigue auditando `REPORTE_SIN_SUSCRIPCION` (SPEC-242); usuario activo en `/api/me` sigue recibiendo 200 con su perfil.
- **FR-005**: La auditoría DEBE tolerar `usuarioId` null (la columna ya es nullable; los reportes anónimos auditan sin usuario) — se garantiza no escribiendo ids inexistentes.

## Criterios de aceptación

- [x] JWT de usuario eliminado en `/reportar` → render 200 como anónimo, sin crash P2003 y sin fila en `AuditLog`.
- [x] JWT de usuario eliminado en `/api/me` → 401 `AUTH_INVALID` + `Set-Cookie` expirando `__Host-token` y `token`.
- [x] PARENT real sin suscripción en `/reportar` → auditoría `REPORTE_SIN_SUSCRIPCION` intacta.
- [x] `getSessionUser` con usuario activo devuelve el usuario; con inactivo/eliminado/token inválido/sin cookie devuelve null.
- [x] Gate completo verde (`tsc --noEmit`, `lint`, `test`, `build`).

## Implementación

- `src/lib/auth.ts`: nuevo `getSessionUser()` — resolución de sesión para Server Components con verificación en BD (huérfano/inactivo ⇒ null).
- `src/app/reportar/layout.tsx`: usa `getSessionUser()` en vez de `payload.sub` crudo; la sesión huérfana se trata como anónima (sin verificación de suscripción ni auditoría).
- `src/app/api/me/route.ts`: en 401 expira `__Host-token` y `token` en la respuesta (mismos atributos que logout, Spec 106) — corta el loop.
- Tests nuevos (12, integración con BD real): `src/lib/auth-sesion-huerfana.test.ts`, `src/app/reportar/layout.sesion-huerfana.test.ts` (verificado por mutación: con el código viejo el primer test revienta P2003), `src/app/api/me/route.test.ts`.

## Deuda técnica

- Otras páginas resuelven `payload.sub` por su cuenta (`/mis-reportes`, `/consentimiento`, dashboards): todas consultan repositorios y toleran null (redirect a /login), así que no explotan; migrarlas a `getSessionUser()` queda como higiene opcional.
- El proxy de edge sigue sin poder detectar sesiones huérfanas (solo firma); el corte real vive en `verifyAuth`/`getSessionUser`.
