# Implementation Plan: Puente de sesión PI→BI (endpoint /api/auth/link-bi)

**Branch**: `work/pi-SPEC-310-puente-sesion-bi-link` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/310-puente-sesion-bi-link/spec.md`

## Summary

Nuevo endpoint `GET /api/auth/link-bi` que valida la sesión PI actual reutilizando `verifyAuth()`, genera un JWT efímero (TTL 60s, `linkTo:"bi"`) con `jose` (misma librería que el resto de la auth PI), y redirige 302 hacia el endpoint equivalente de BI. Sin sesión válida, redirige a `/login` encadenando el retorno. `returnTo` pasa por una whitelist estricta de hosts para evitar open redirect.

## Technical Context

**Language/Version**: TypeScript 5 (strict) + Node.js >= 22

**Primary Dependencies**: Next.js App Router (route handler GET), `jose` (ya instalada — SignJWT, mismo patrón que `src/lib/auth.ts`)

**Storage**: N/A — el JWT efímero no se persiste en ninguna tabla

**Testing**: Vitest — unitario, con `verifyAuth` mockeado (los 5 casos del brief: sesión sí/no, returnTo válido/inválido/malformado) + test unitario puro de `validarReturnTo`

**Target Platform**: Next.js App Router, mismo runtime que el resto de `src/app/api/auth/**`

**Project Type**: web-service (feature dentro del monorepo existente 002-2026-PROTECCION-INFANTIL)

**Performance Goals**: Sin objetivo especial — un lookup de usuario (ya lo hace `verifyAuth`) + firma JWT síncrona; latencia despreciable frente al resto de la app

**Constraints**: Cero cambios en `src/lib/auth.ts`, `login/route.ts`, `logout/route.ts`, `prisma/**`; JWT_SECRET nunca en chat/commit; TTL 60s fijo; whitelist de `returnTo` estática en código

**Scale/Scope**: 1 endpoint nuevo + 1 helper puro (`validarReturnTo`) + tests, sin nuevas entidades de datos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verificado contra `.specify/memory/constitution.md`: feature de infraestructura de autenticación cross-dominio, no toca ninguno de los 6 principios de producto (§1). Principios técnicos (§2): reutiliza el stack heredado (Next.js App Router, `jose` ya usada en auth), no introduce ORM/framework/librería nueva salvo la corrección documentada en Assumptions (se mantiene `jose`, se descarta `jsonwebtoken` que ni siquiera está instalado). Sin violaciones. Gate: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/310-puente-sesion-bi-link/
├── plan.md              # Este archivo
├── quickstart.md         # Ver "Verificación manual" abajo, embebida (feature chica, sin archivo aparte)
├── contracts/            # No aplica (contrato ya documentado en spec.md FR-001..FR-006; un solo endpoint GET)
└── tasks.md               # Fase 2 (/speckit-tasks, tras APROBADO de Fábrica)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/app/api/auth/link-bi/
│   ├── route.ts                # NUEVO — GET, orquesta verifyAuth + validarReturnTo + firma JWT + redirect
│   └── route.test.ts           # NUEVO — 5+ casos (sesión sí/no · returnTo válido/inválido/malformado · payload JWT)
├── src/lib/auth/
│   └── validar-return-to.ts    # NUEVO — función pura, testeable sin mocks de red
├── src/lib/auth/
│   └── validar-return-to.test.ts  # NUEVO — casos puros de whitelist
├── .env.example                 # MODIFICADO — + BI_BASE_URL
└── specs/310-puente-sesion-bi-link/  # spec.md · plan.md · tasks.md · checklists/
```

**Structure Decision**: `validarReturnTo` vive como función pura en `src/lib/auth/` (carpeta nueva, junto al resto de helpers de auth) para poder testearla sin mockear `next/headers` ni la BD — separa la lógica de seguridad (fácil de auditar y testear exhaustivamente) de la orquestación HTTP del route handler.

## Decisiones de diseño (research inline — feature pequeña, sin research.md separado)

1. **`jose`, no `jsonwebtoken`** (Assumptions del spec): `jsonwebtoken` no está en `package.json`; `jose` ya firma/verifica todos los tokens PI. Se usa `SignJWT` con `.setExpirationTime("60s")` — mismo patrón builder que `createToken()` en `auth.ts`, sin reutilizar esa función directamente porque su TTL viene de `ParametroSistema` (pensado para sesiones de 24h, no para un token de 60s) y modificarla afectaría el login real.
2. **Secreto**: `getSecret()` en `auth.ts` no está exportada y `auth.ts` queda con diff cero (candado explícito). El endpoint nuevo carga el secreto con `requireEnv("JWT_SECRET", 32)` (mismo helper compartido que ya usa `auth.ts`, sin tocar ese archivo) + `new TextEncoder().encode(...)`, duplicando una línea trivial en vez de exportar un símbolo nuevo desde un archivo marcado solo-lectura.
3. **Reuso de `verifyAuth()`**: en vez de reimplementar lectura de cookie + verificación JWT + lookup de usuario (que ya vive completo en `verifyAuth()`, incluyendo el chequeo de `sesionLogId`/sesión activa), el endpoint llama `verifyAuth()` dentro de un `try/catch` — captura el `AppError` que lanza y lo traduce a un redirect a `/login`, en vez de dejar que se propague como JSON 401 (que es el comportamiento por defecto de `verifyAuth` en el resto de la API).
4. **`roles` como arreglo de un elemento**: el token de sesión PI actual guarda `rol` (singular). El payload efímero construye `roles: [user.rol]` para igualar el shape plural que espera el endpoint BI (`/api/auth/link`), sin cambiar el modelo de roles de PI (que sigue siendo single-rol).
5. **Whitelist de `returnTo`**: comparación exacta de `URL.host` (incluye puerto) contra una lista fija (`bi.innovadataco.com`, `localhost:3001`), con `URL.protocol` restringido a `http:`/`https:`. Cualquier excepción al parsear (`new URL(returnTo)` sin base) — incluyendo URLs protocol-relative como `//atacante.com` — se trata como inválida y cae al default.

## Complexity Tracking

*Sin violaciones de constitución; tabla omitida.*
