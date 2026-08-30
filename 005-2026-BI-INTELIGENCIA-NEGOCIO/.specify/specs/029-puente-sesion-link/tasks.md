# TASKS-029 · Puente sesión PI ↔ BI

## F1 · Endpoint `GET /api/auth/link`
- [ ] `src/app/api/auth/link/route.ts` con lectura de query, verifyToken reutilizado (candado 22), validación `linkTo === "bi"` + `exp`, extracción `sub`+`role`, chequeo `bad_claim`
- [ ] Firma del nuevo JWT (session · 24 h · sin `linkTo`) con `SignJWT` de `jose` (misma librería)
- [ ] Set-Cookie `session` con atributos exactos (Path=/ · Secure en prod · HttpOnly · SameSite=Lax · maxAge 86400)
- [ ] `sanitizeReturnTo` con whitelist estricta (`/dashboard`, `/chat`, `/api/bi/`) · rechazo silencioso → `/dashboard`
- [ ] Errores → redirect 302 `/login-error?reason=<invalid_token|expired|bad_claim>`

## F2 · Página `/login-error`
- [ ] `src/app/login-error/page.tsx` · Server Component mínimo · mapa de reasons

## F3 · Guard SPEC-024
- [ ] SPEC-024 mergeada al worktree (o esperar mergea en `main`)
- [ ] Modificar `src/app/dashboard/layout.tsx`: reemplazar `redirect("/login")` por `redirect(\`${PI_BASE_URL}/api/auth/link-bi?returnTo=<absoluteUrl>\`)`
- [ ] Investigar patrón exacto Next.js App Router para extraer path del request en Server Component (`headers()` + `x-invoke-path` con fallback a `/dashboard`)

## F4 · Documentación `.env.bi.example`
- [ ] Añadir `BI_BASE_URL` con comentario explicando su uso
- [ ] Documentar que `JWT_SECRET` DEBE coincidir con el de PI (env compartido)

## F5 · Tests unitarios
- [ ] `tests/unit/bi-auth-link-endpoint.test.ts` · 8 tests (sin token · firma inválida · linkTo mal · sub/role faltante · flujo OK · returnTo válido · evil.com rechazado · path fuera whitelist rechazado)
- [ ] `tests/unit/bi-login-error-page.test.tsx` · 2 tests (sin reason · reason expired)

## F6 · Gate local
- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run typecheck` verde
- [ ] `npx vitest run` verde
- [ ] Ratchets 4/5 verdes (mv-schema-check SKIP · pre-existente Dev BI-2)
- [ ] `curl` con JWT armado a mano confirma Set-Cookie session correcto + redirect 302

## F7 · Push
- [ ] `git add` archivos listados en plan.md F7
- [ ] `git commit -m "feat(bi): SPEC-029 endpoint /api/auth/link + guard redirige a PI link-bi (fix I-30)"`
- [ ] `git push origin work/bi-SPEC-029-puente-sesion`

## Cierre
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-029 · REALIZADO · <hash> · gh pr checks OK`
- [ ] Verificación E2E en vivo con Jelkin: DEFERIDA hasta que SPEC-PI paralelo esté también desplegado (orden Brief §4: PI primero, BI segundo)

## Reglas duras (no marcar CUMPLE si alguna falla)
- [ ] `JWT_SECRET` NUNCA aparece en commit/log/print (candado 22)
- [ ] `returnTo` NUNCA acepta host arbitrario
- [ ] TTL 60 s del token ephemeral se respeta · nunca se extiende en BI
- [ ] `src/lib/auth/jwt.ts` NO se modifica · `src/lib/auth/sesion.ts` NO se modifica
