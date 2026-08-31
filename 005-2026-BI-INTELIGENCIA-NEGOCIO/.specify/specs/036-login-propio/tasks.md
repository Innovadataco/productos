# TASKS-036 · Login propio de BI

## F1 · `sanitizeReturnTo` compartido
- [ ] `src/lib/auth/return-to.ts` · extraído de /api/auth/link · whitelist con `/operacion` agregado

## F2 · `POST /api/auth/login`
- [ ] Lee BI_AUTH_USER/BI_AUTH_PASSWORD en REQUEST TIME · compara `===` en claro (concesión Jelkin)
- [ ] Error sin decir cuál falló · sin cookie
- [ ] OK → SignJWT session {sub,role:ADMIN} TTL 24h + cookie (httpOnly·secure prod·lax·path/·24h) + 302 returnTo

## F3 · `POST /api/auth/logout`
- [ ] Borra cookie session (maxAge 0) + redirect /login

## F4 · `login/page.tsx`
- [ ] Reemplaza redirect a PI por FORM usuario+password+entrar · lee ?returnTo= · muestra error si ?error=1

## F5 · Botón cerrar sesión visible
- [ ] `CerrarSesion.tsx` (client · POST /api/auth/logout)
- [ ] En BiAppShell (dashboard) + BarraOperacion (/operacion) + header /chat

## F6 · Guard
- [ ] `guard-bi-sesion.ts` → redirect a `/login?returnTo=<ruta>` (relativa · no PI)

## F7 · Retirar segunda puerta
- [ ] `git rm src/app/api/auth/link/route.ts` + su test
- [ ] NO tocar link-bi de PI (002-*)

## F8 · `.env.bi.example`
- [ ] Placeholders BI_AUTH_USER / BI_AUTH_PASSWORD (sin valores)

## F9 · Tests
- [ ] `bi-login.test.ts` · ok→cookie+returnTo · mal→error sin cookie · config faltante→error · returnTo whitelist · logout
- [ ] `bi-return-to.test.ts` · whitelist con /operacion · evil host→/dashboard
- [ ] ajustar `bi-operacion-guard.test.tsx` · destino ahora /login · anti-drift genérico sigue verde

## F10 · Gate local (ESCALONADO · aviso antes del build)
- [ ] avisar a Fábrica antes de `next build` (RAM · coordinar con BI-1)
- [ ] build · typecheck · test:unit · ratchets 4/5
- [ ] PARAR si el build hace swapear Ollama en serio (prioridad PI prod)

## F11 · Evidencia §6 (6 obligatorias)
- [ ] 1. anónimo /operacion Y /dashboard → 307 a /login de BI (no PI, no 200)
- [ ] 2. anónimo → HTML sin PII (grep vacío)
- [ ] 3. login correcto returnTo=/operacion → aterriza en /operacion
- [ ] 4. cambiar clave en env + reiniciar → nueva sirve, vieja no (sin deploy)
- [ ] 5. logout → vuelve a /login, /operacion deja de abrirse
- [ ] 6. recargar autenticado → NO re-pide clave

## F12 · Push + PR
- [ ] commit (con git rm) + push + `gh pr create --base main`
- [ ] Señal REALIZADO + 6 evidencias

## Reglas duras (Jelkin)
- [ ] Reemplaza, NO convive (una sola puerta · /api/auth/link retirado)
- [ ] Clave EN CLARO (concesión · no hash)
- [ ] Cambiar clave = .env + reiniciar · sin PR/deploy · env en request time
- [ ] NO: rate limit, hash, recuperación, multiusuario, roles
- [ ] Secretos solo en .env · nunca en código/chat
