# RESEARCH-036 · Login propio de BI

## Estado actual (verificado en fuente · main con 035)

### `src/app/login/page.tsx`
Hoy: `redirect(\`${PI_BASE_URL}/login\`)`. Se reemplaza por el form propio.

### `src/app/api/auth/link/route.ts` (se RETIRA)
Recibe un JWT ephemeral de PI, lo verifica, y setea la cookie `session`. Es la SEGUNDA puerta que causó I-33. Contiene `sanitizeReturnTo` (whitelist `/dashboard`, `/chat`, `/api/bi/` — **le falta `/operacion`**, porque se escribió antes de SPEC-033) y el patrón de `SignJWT` que se reusa en el login. Se extrae `sanitizeReturnTo` a `src/lib/auth/return-to.ts` (agregando `/operacion`) ANTES de `git rm`.

### `src/lib/auth/guard-bi-sesion.ts` (SPEC-035)
Hoy redirige a `${PI_BASE_URL}/api/auth/link-bi?returnTo=${enc(bi+rutaBi)}`. Se cambia a `/login?returnTo=${enc(rutaBi)}` (ruta relativa). Único lugar con la lógica de guard → un solo cambio cubre dashboard/operacion/chat.

### `sesion.ts` / `jwt.ts` (SOLO LECTURA)
`sesionDeRequest` lee la cookie `session` (JWT con `sub`+`role`); `verifyToken` valida con `JWT_SECRET`. El login firma exactamente ese shape → la sesión que crea es la misma que el guard ya sabe leer. No se tocan.

### Puntos de inserción del botón "Cerrar sesión"
- `BiAppShell.tsx` (sidebar · cubre `/dashboard/**`).
- `BarraOperacion.tsx` (`.bar` de `/operacion`).
- `chat/page.tsx` (`<header>` · hoy muestra "Usuario mock").

### Enumeración de endpoints `/api/auth` tras 036
- `login` (nuevo · POST) · `logout` (nuevo · POST) · `link` (RETIRADO).
- `/api/health`, `/api/bi/*` no cambian (kpis/aprobar/rechazar/preguntar/estado-sistema ya guardados en 035).

## Decisiones de diseño

### D-036.1 · Reemplaza, no convive (una sola puerta)
Retirar `/api/auth/link` es central, no accesorio: dejarlo vivo mantiene la segunda puerta que fue I-33. El guard pasa a `/login`. El `link-bi` de PI queda huérfano (redirige a un endpoint BI que ya no existe → 404, no acceso); lo limpia PI-1 después. Documentado para el deploy.

### D-036.2 · Clave en claro (concesión consciente de Jelkin)
`===` directo, sin hash. Es una decisión explícita de Jelkin para Fase 1 (una credencial admin, editable por SSH). Se documenta como concesión, no defecto. La única capa es el `.env` 600 fuera de git.

### D-036.3 · Env en request time
`BI_AUTH_USER`/`BI_AUTH_PASSWORD`/`JWT_SECRET` se leen DENTRO del handler POST, no en top-level del módulo. Así cambiar el `.env` + reiniciar el contenedor toma efecto sin rebuild (requisito NO NEGOCIABLE de Jelkin). Evidencia §6.4 lo prueba.

### D-036.4 · Error de login sin distinguir usuario/clave
Un solo mensaje "usuario o contraseña incorrectos" para no filtrar cuál de los dos existe. Además cubre config faltante (env vacías) con el mismo error, sin cookie.

### D-036.5 · `returnTo` reusa la whitelist (defensa open-redirect)
`sanitizeReturnTo` extraído · whitelist `/dashboard`, `/operacion`, `/chat`, `/api/bi/` · host ajeno o fuera de whitelist → `/dashboard`. Mismo criterio que SPEC-029/030.

### D-036.6 · El anti-drift de 035 sobrevive sin cambios
El test genérico afirma "hay redirect", NO el destino. Al cambiar el guard de PI a `/login`, el test sigue pasando (por eso se hizo genérico). Solo el test informativo de destino se ajusta a `/login`.

## Fuentes consultadas

- `src/app/login/page.tsx`, `src/app/api/auth/link/route.ts` (sanitizeReturnTo + SignJWT), `src/lib/auth/guard-bi-sesion.ts`, `sesion.ts`, `jwt.ts`
- `BiAppShell.tsx`, `BarraOperacion.tsx`, `chat/page.tsx` (inserción del botón)
- INSTRUCTIVO-021 (reglas de alcance de Jelkin)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 19:1x COT |
| **Autor** | Dev BI-2 |
