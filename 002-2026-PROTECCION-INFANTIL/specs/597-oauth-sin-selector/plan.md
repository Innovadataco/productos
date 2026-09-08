# SPEC-597 · Plan — Quitar selector de cuenta del OAuth de Google

Ver `spec.md` (decisión CEO, FR-001–FR-003) y `tasks.md` (fases y tareas).

## Contexto y decisión

Decisión EXACTA del CEO (Jelkin, 08-09-2026): entrar DIRECTO con la sesión de Google activa al pulsar «Continúa con Google». SPEC-587 introdujo `prompt=select_account` en la auth URL, que obliga a Google a mostrar siempre la pantalla intermedia de selección de cuenta. Se quita el parámetro completo (no se usa `prompt=none`: fallaría sin sesión).

## Enfoque técnico

- **Un solo lugar toca la URL**: `buildGoogleAuthUrl` en `src/lib/auth-oauth.ts`. Quitar la entrada `prompt: "select_account"` del `URLSearchParams` y ajustar el docstring.
- **Sin `prompt=none`**: el comportamiento por defecto de Google ya es el deseado — sesión activa + consentimiento previo → redirección directa al callback; sin sesión → flujo de credenciales normal.
- **Candado de regresión en el test**: el caso de la auth URL afirma `params.get("prompt") === null` y que la URL no contiene `select_account`, además de mantener los asertos de `client_id`, `redirect_uri`, `response_type`, `scope` y `state`.
- Callback (`callbackUriDe`), intercambio code→token e userinfo no cambian.

## Riesgos y mitigaciones

- **Regresión silenciosa** (alguien vuelve a agregar `prompt`): cubierto por el candado del test.
- **Múltiples cuentas de Google activas**: sin `prompt`, Google puede seguir mostrando un selector liviano si la sesión no es unívoca; es el comportamiento estándar del proveedor y aceptado por la decisión CEO (entrar directo con la sesión recordada).
- **Secretos**: la configuración OAuth (IDs/secrets) no se toca ni se documenta; viven solo en variables de entorno.
