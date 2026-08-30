# TASKS-029 · Puente sesión PI ↔ BI

## F1 · Endpoint `GET /api/auth/link`
- [x] `src/app/api/auth/link/route.ts` con lectura de query, verifyToken reutilizado (candado 22), validación `linkTo === "bi"` + `exp`, extracción `sub`+`role`, chequeo `bad_claim`
- [x] Firma del nuevo JWT (session · 24 h · sin `linkTo`) con `SignJWT` de `jose` (misma librería)
- [x] Set-Cookie `session` con atributos exactos (Path=/ · Secure en prod · HttpOnly · SameSite=Lax · maxAge 86400)
- [x] `sanitizeReturnTo` con whitelist estricta (`/dashboard`, `/chat`, `/api/bi/`) · rechazo silencioso → `/dashboard`
- [x] Errores → redirect 302 `/login-error?reason=<invalid_token|expired|bad_claim>`

## F2 · Página `/login-error`
- [x] `src/app/login-error/page.tsx` · Server Component mínimo · mapa de reasons + link "Reintentar"

## F3 · Guard SPEC-024
- [x] SPEC-024 mergeada al worktree (merge de `origin/work/bi-SPEC-024-layout-sidebar`)
- [x] Modificar `src/app/dashboard/layout.tsx`: reemplazar `redirect("/login")` por `redirect(\`${PI_BASE_URL}/api/auth/link-bi?returnTo=<absoluteUrl>\`)`
- [x] Uso de `headers()` + `x-invoke-path` / `x-forwarded-uri` con fallback a `/dashboard`

## F4 · Documentación `.env.bi.example`
- [x] Añadir `BI_BASE_URL` con comentario explicando su uso
- [x] Documentar que `JWT_SECRET` DEBE coincidir con el de PI (env compartido)

## F5 · Tests unitarios
- [x] `tests/unit/bi-auth-link-endpoint.test.ts` · 9 tests · verdes
- [x] `tests/unit/bi-login-error-page.test.tsx` · 2 tests · verdes
- [x] `// @vitest-environment node` en endpoint test (jose 6 webapi rechaza Uint8Array de jsdom polyfill)

## F6 · Gate local (2026-08-29 21:12 COT)
- [x] `rm -rf .next && npm run build` verde · 11 rutas correctas (nuevas `/api/auth/link` y `/login-error`)
- [x] `npm run typecheck` verde
- [x] `npx vitest run` · **128 passed · 15 skipped · 0 failed** en suite completa
- [x] Ratchets 4/5 verdes (mv-schema-check SKIP · pre-existente Dev BI-2)
- [x] `curl` E2E con JWT armado local (mismo `JWT_SECRET`):
  - `GET /api/auth/link?token=<jwt>&returnTo=/dashboard` → 302 · `location: http://localhost:3011/dashboard` · `Set-Cookie: session=<jwt-24h>; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=lax` ✅
  - `GET /api/auth/link` sin token → 302 · `/login-error?reason=invalid_token` ✅
  - `GET /api/auth/link?token=<jwt>&returnTo=https://evil.com/x` → 302 · `/dashboard` (whitelist rechaza silencioso) ✅
  - `GET /login-error?reason=expired` → HTML con "caducó" ✅

## F7 · Push
- [ ] `git add` archivos listados en plan.md F7
- [ ] `git commit -m "feat(bi): SPEC-029 endpoint /api/auth/link + guard redirige a PI link-bi (fix I-30)"`
- [ ] `git push origin work/bi-SPEC-029-puente-sesion`

## Cierre
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-029 · REALIZADO · <hash> · gh pr checks OK`
- [ ] Verificación E2E en vivo con Fábrica BI-2 + SPEC-PI paralelo (pediste que te avise antes del CUMPLE dado que es candado de seguridad · auth)

## Reglas duras (no marcar CUMPLE si alguna falla)
- [ ] `JWT_SECRET` NUNCA aparece en commit/log/print (candado 22)
- [ ] `returnTo` NUNCA acepta host arbitrario
- [ ] TTL 60 s del token ephemeral se respeta · nunca se extiende en BI
- [ ] `src/lib/auth/jwt.ts` NO se modifica · `src/lib/auth/sesion.ts` NO se modifica
