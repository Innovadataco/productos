# Plan · SPEC-603 · Sesión huérfana

Hotfix urgente (bug verificado en producción). Sin cambios de schema, proxy, navegación ni stack.

## Diagnóstico (previo)

- Punto del crash: `src/app/reportar/layout.tsx` — única auditoría en render de Server Component que usaba `payload.sub` del JWT sin verificar existencia en BD (`git grep prisma.auditLog.create -- src` → helper `logAudit` en `src/lib/audit.ts`; el layout lo llamaba con `usuarioId` huérfano → P2003).
- `verifyAuth` (`src/lib/auth.ts`) ya devuelve 401 cuando el usuario no existe — contrato correcto para `/api/**`; el loop venía de que nadie expiraba la cookie.
- `AuditLog.usuarioId` es nullable (`prisma/schema.prisma:956`) y `logAudit` ya escribe null cuando no hay usuario — la tolerancia existía; el problema era el id inexistente.

## Diseño

1. `src/lib/auth.ts` — `getSessionUser()`: cookie → `verifyToken` → `prisma.usuario.findUnique` → null si no existe o está inactivo. Punto único de corte para Server Components.
2. `src/app/reportar/layout.tsx` — consume `getSessionUser()`; huérfano ⇒ anónimo (sin auditoría). El rol ahora sale de la BD, no del claim del JWT (más fiel).
3. `src/app/api/me/route.ts` — 401 ⇒ expira `__Host-token` + `token` en la respuesta (route handler: único contexto que puede mutar cookies fuera de Server Actions; el proxy solo limpia cuando la firma falla).

## Verificación

- 3 archivos de test nuevos (12 tests, BD real): auth-sesion-huerfana, layout de /reportar, /api/me.
- Gate: `npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build`.
- No requiere `./scripts/dev-restart.sh` en el worktree (sin cambios de runtime del entorno dev del checkout principal).
