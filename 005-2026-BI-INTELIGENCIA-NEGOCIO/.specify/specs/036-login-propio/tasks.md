# TASKS-036 · Login propio de BI

## F1 · `sanitizeReturnTo` compartido
- [x] `src/lib/auth/return-to.ts` · extraído de /api/auth/link · whitelist con `/operacion` agregado

## F2 · `POST /api/auth/login`
- [x] Lee BI_AUTH_USER/BI_AUTH_PASSWORD en REQUEST TIME · compara `===` en claro (concesión Jelkin)
- [x] Error sin decir cuál falló · sin cookie
- [x] OK → SignJWT session {sub,role:ADMIN} TTL 24h + cookie (httpOnly·secure prod·lax·path/·24h) + 302 returnTo

## F3 · `POST /api/auth/logout`
- [x] Borra cookie session (maxAge 0) + redirect /login

## F4 · `login/page.tsx`
- [x] Reemplaza redirect a PI por FORM usuario+password+entrar · lee ?returnTo= · muestra error si ?error=1

## F5 · Botón cerrar sesión visible
- [x] `CerrarSesion.tsx` (client · POST /api/auth/logout)
- [x] En BiAppShell (dashboard) + BarraOperacion (/operacion) + header /chat

## F6 · Guard
- [x] `guard-bi-sesion.ts` → redirect a `/login?returnTo=<ruta>` (relativa · no PI)

## F7 · Retirar segunda puerta
- [x] `git rm src/app/api/auth/link/route.ts` + su test
- [x] NO tocar link-bi de PI (002-*)

## F8 · `.env.bi.example`
- [x] Placeholders BI_AUTH_USER / BI_AUTH_PASSWORD (sin valores)

## F9 · Tests
- [x] `bi-login.test.ts` · ok→cookie+returnTo · mal→error sin cookie · config faltante→error · returnTo whitelist · logout
- [x] `bi-return-to.test.ts` · whitelist con /operacion · evil host→/dashboard
- [x] ajustar `bi-operacion-guard.test.tsx` · destino ahora /login · anti-drift genérico sigue verde

## F10 · Gate local (ESCALONADO · aviso antes del build)
- [x] avisar a Fábrica antes de `next build` (RAM · coordinar con BI-1)
- [x] build · typecheck · test:unit · ratchets 4/5
- [x] PARAR si el build hace swapear Ollama en serio (prioridad PI prod)

## F11 · Evidencia §6 (6 obligatorias)
- [x] 1. anónimo /operacion Y /dashboard → 307 a /login de BI (no PI, no 200)
- [x] 2. anónimo → HTML sin PII (grep vacío)
- [x] 3. login correcto returnTo=/operacion → aterriza en /operacion
- [x] 4. cambiar clave en env + reiniciar → nueva sirve, vieja no (sin deploy)
- [x] 5. logout → vuelve a /login, /operacion deja de abrirse
- [x] 6. recargar autenticado → NO re-pide clave

## F12 · Push + PR
- [ ] commit (con git rm) + push + `gh pr create --base main`
- [ ] Señal REALIZADO + 6 evidencias

## Reglas duras (Jelkin)
- [x] Reemplaza, NO convive (una sola puerta · /api/auth/link retirado)
- [x] Clave EN CLARO (concesión · no hash)
- [x] Cambiar clave = .env + reiniciar · sin PR/deploy · env en request time
- [x] NO: rate limit, hash, recuperación, multiusuario, roles
- [x] Secretos solo en .env · nunca en código/chat
