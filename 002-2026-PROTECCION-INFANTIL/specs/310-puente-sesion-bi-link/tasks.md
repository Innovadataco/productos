# Tasks: Puente de sesión PI→BI (endpoint /api/auth/link-bi)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

## Phase 1: Setup

- [ ] T001 Agregar `BI_BASE_URL="https://bi.innovadataco.com"` a `.env.example` con comentario "puente sesión PI→BI · SPEC-310"

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T002 Crear `src/lib/auth/validar-return-to.ts` — función pura `validarReturnTo(returnTo: string | null): string` que devuelve el `returnTo` tal cual si su host está en la whitelist (`bi.innovadataco.com` cualquier protocolo https; `localhost:3001` http o https) y protocolo es http/https, o el default `https://bi.innovadataco.com/dashboard` en cualquier otro caso (ausente, malformado, host fuera de whitelist, protocol-relative)
- [ ] T003 [P] Crear `src/lib/auth/validar-return-to.test.ts` — casos puros: host permitido prod, host permitido dev (ambos protocolos), host ajeno, `javascript:`, `//atacante.com`, ausente, vacío

**Checkpoint**: `validarReturnTo` cubre los 4 escenarios de la User Story 3 sin depender de HTTP/BD.

## Phase 3: User Story 1 - Sesión PI activa → puente hacia BI (P1)

**Goal**: Con sesión PI válida, el endpoint genera un JWT efímero y redirige 302 a BI.

**Independent Test**: `GET /api/auth/link-bi?returnTo=...` con `verifyAuth()` mockeado para devolver un usuario válido → 302 a `${BI_BASE_URL}/api/auth/link?token=...&returnTo=...`, payload del JWT decodificable con `sub`/`email`/`role`/`linkTo:"bi"`/`exp` a 60s.

- [ ] T004 [US1] Crear `src/app/api/auth/link-bi/route.ts` — `GET`: llama `verifyAuth()`; si resuelve, arma payload `{sub: user.id, email: user.email, role: user.rol, linkTo: "bi"}` (claim `role` singular string, confirmado por contrato bilateral con BI — NO `roles` arreglo), firma con `jose` `SignJWT` (`.setProtectedHeader({alg:"HS256"})` + `.setIssuedAt()` + `.setExpirationTime("60s")` + secreto vía `requireEnv("JWT_SECRET", 32)` encodeado, sin tocar `auth.ts`), valida `returnTo` con `validarReturnTo()`, responde `NextResponse.redirect` 302 a `${requireEnv("BI_BASE_URL")}/api/auth/link?token=<JWT>&returnTo=<encodeURIComponent(returnTo validado)>`
- [ ] T005 [P] [US1] En `src/app/api/auth/link-bi/route.test.ts`: caso "sesión válida + returnTo válido → 302 a BI con JWT+returnTo", verificando el payload decodificado (`sub`, `email`, `role` string exacto de `user.rol`, `linkTo:"bi"`, `exp` ≈ ahora+60s ±5s)

**Checkpoint**: Camino feliz completo, verificable end-to-end con `verifyAuth` mockeado.

## Phase 4: User Story 2 - Sin sesión PI → encadena a /login (P1)

**Goal**: Sin sesión válida (ausente, inválida, expirada, usuario inactivo), el endpoint redirige a `/login` preservando la intención de volver al puente.

**Independent Test**: `GET /api/auth/link-bi?returnTo=...` con `verifyAuth()` mockeado para lanzar `AppError` (401) → 302 a `/login?returnTo=/api/auth/link-bi?returnTo=<original>`.

- [ ] T006 [US2] En `route.ts` (T004): envolver la llamada a `verifyAuth()` en `try/catch`; en el `catch`, redirigir 302 a `/login?returnTo=${encodeURIComponent("/api/auth/link-bi?returnTo=" + returnToOriginal)}` sin generar JWT
- [ ] T007 [P] [US2] En `route.test.ts`: 2 casos — `verifyAuth` rechaza (sin cookie / inválida) → 302 a `/login?returnTo=...`; verificar que el `returnTo` encadenado reconstruye la URL original del puente

**Checkpoint**: Los 2 caminos de sesión (con/sin) cubiertos independientemente.

## Phase 5: User Story 3 - Defensa open redirect (P1)

**Goal**: Ningún `returnTo` fuera de la whitelist llega al redirect final sin pasar por el default seguro.

**Independent Test**: Con sesión válida mockeada, `returnTo` fuera de whitelist / malformado / protocol-relative → el redirect a BI usa siempre el default, nunca el valor recibido.

- [ ] T008 [US3] En `route.test.ts`: 4 casos integrando `validarReturnTo` real dentro del route handler — host ajeno, `javascript:`, `//atacante.com`, `returnTo` ausente → todos caen al default `https://bi.innovadataco.com/dashboard`
- [ ] T009 [P] [US3] En `route.test.ts`: 1 caso positivo adicional — `returnTo=http://localhost:3001/dashboard` (host dev) se preserva tal cual en el redirect

**Checkpoint**: Los 5 casos obligatorios del instructivo (JWT válido/inválido · sesión sí/no · returnTo válido/inválido) + payload verificado, todos en verde.

## Phase 6: Polish

- [ ] T010 Verificar con `grep -rn "console\." src/app/api/auth/link-bi/` que no quedan `console.log` de debug
- [ ] T011 `npx tsc --noEmit` limpio
- [ ] T012 `npm run lint -- src/app/api/auth/link-bi/route.ts src/app/api/auth/link-bi/route.test.ts src/lib/auth/validar-return-to.ts src/lib/auth/validar-return-to.test.ts` + grep explícito de `error` en la salida (candado 24/D-55 — no confiar en lint global filtrado)
- [ ] T013 `npm run arch:check` verde (nueva ruta pública/privada evaluada por la aserción de roles×rutas — verificar si requiere regenerar `docs/architecture/02-roles-capacidades.md`)
- [ ] T014 Confirmar por diff (`git diff --name-status origin/main..HEAD`) cero cambios en `src/lib/auth.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `prisma/**`
- [ ] T015 Test integración local con Fábrica BI-2/Jelkin si el endpoint BI (`/api/auth/link`) ya existe cuando se llegue a esta fase; si no, dejarlo documentado como pendiente de coordinación post-merge (no bloquea REALIZADO de la parte PI)

## Dependencies

- Phase 2 (Foundational) bloquea las 3 historias — todas llaman `validarReturnTo`
- US1 (Phase 3) es el camino feliz; US2 (Phase 4) y US3 (Phase 5) extienden el mismo `route.ts` con casos adicionales — en la práctica T004 implementa las 3 historias de una vez (un solo endpoint pequeño), pero los tests quedan organizados por historia para trazabilidad
- Phase 6 depende de que las 3 historias estén implementadas y testeadas

## Implementation Strategy

**MVP = User Story 1 + 2** (camino feliz + fallback a login): sin US3 el endpoint funcionaría pero sería vulnerable a open redirect, así que en la práctica las 3 historias se implementan juntas en un solo endpoint chico — no hay entrega incremental real por lo acotado del alcance (~2h estimadas).
