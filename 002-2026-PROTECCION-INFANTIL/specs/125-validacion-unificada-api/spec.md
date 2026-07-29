# SPEC-125 — API: una sola forma de validar

- **Status**: IMPLEMENTADO
- **Bloque**: R6 (cola nocturna 002-PI-041, FASE 3)
- **Fecha**: 2026-07-29

## Contexto

La mayoría de las rutas API ya validan el body con Zod (`safeParse` inline,
`parseBody`/`withValidation` de `src/lib/validation.ts`), pero queda un grupo de
rutas — entre ellas las públicas de autenticación — que hacen `request.json()`
crudo con chequeos manuales (`as { email: string }`, `if (!email) ...`). Además,
la verificación del secreto del worker (`x-worker-secret`) está copiada en dos
sitios y las rutas API mezclan `console.error/warn` con el `logger` central
(`src/lib/logger.ts`, ya usado en las libs). Tres formas de hacer lo mismo
divergen: mensajes distintos, status distintos, y casts `as` que mienten si el
payload no es un objeto (un body no-objeto hoy produce un 500 en vez de un 400).

## User Stories

### US1 — Helper único del secreto del worker (P1)

Como mantenedor quiero UN helper (`src/lib/worker-auth.ts`) que verifique
`x-worker-secret`, usado por todos los endpoints del worker, para que el chequeo
no pueda divergir.

**Acceptance Scenarios**
1. Dado un request sin header `x-worker-secret`, cuando llega a
   `/api/reportes/procesar` o `/api/reportes/fallback`, responde 403 con
   `{ error: { code: FORBIDDEN } }`.
2. Dado un request con el secreto correcto, pasa al handler.
3. Dado el helper, tiene test unitario: sin secreto → 403, secreto erróneo →
   403, secreto correcto → ok.

### US2 — Rutas públicas de auth con esquema (P1)

Como mantenedor quiero que `auth/login`, `auth/verificar/{solicitar,validar,completar}`
y `auth/recuperar/validar` validen con esquemas Zod compartidos
(`src/lib/validators.ts`), conservando EXACTAMENTE los mensajes y códigos de
error que el frontend consume (`AuthContext` y `registro/page.tsx` leen
`error.message`), para tener una sola forma de validar sin romper la UI.

**Acceptance Scenarios**
1. Dado un payload inválido (falta email/password, código ≠ 6 dígitos, etc.),
   cada ruta responde 400 con el MISMO mensaje que antes de la migración.
2. Dado un payload válido, el flujo es idéntico al anterior (mismos status
   200/201/202 y mismas formas de respuesta).
3. Dado un body que no es objeto JSON válido, responde 400 (no 500).

### US3 — Endpoints del worker con esquema (P1)

`reportes/procesar` y `reportes/fallback` validan su body con esquema y usan el
helper de US1. El único llamante es el worker (`scripts/worker-reportes.mjs`).

**Acceptance Scenarios**
1. Body sin `reporteId` → 400 `reporteId requerido` (contrato actual).
2. Body JSON malformado → 400 `Body inválido` (antes: 500 en fallback).
3. Con secreto y body válidos → comportamiento actual intacto (tests
   existentes verdes).

### US4 — Consulta pública: esquema tolerante (P2)

Los POST de `consulta` y `consulta/detalle` extraen el identificador con un
esquema Zod tolerante (`.catch`) que preserva el contrato de privacidad: el body
NUNCA produce 400 (un body inválido equivale a identificador vacío).

### US5 — Un solo logger en rutas API (P2)

Las rutas API usan `logger` (`src/lib/logger.ts`) en vez de `console.error/warn`,
manteniendo el prefijo `[Módulo]` en el mensaje (patrón de AGENTS.md).

## Functional Requirements

- FR-001: El sistema DEBE tener un único punto de verificación de
  `x-worker-secret` (`src/lib/worker-auth.ts`).
- FR-002: Las rutas migradas DEBEN validar el body con esquemas Zod y NO DEBEN
  cambiar los mensajes/códigos/status de error consumidos por el frontend.
- FR-003: Un body JSON malformado o no-objeto DEBE producir 400 (no 500) en las
  rutas migradas, salvo `consulta`/`consulta/detalle`, que por privacidad
  (spec 091) nunca responden 400 por el body.
- FR-004: Los esquemas nuevos VIVEN en `src/lib/validators.ts` junto a los de
  auth existentes.
- FR-005: Las rutas API DEBEN loguear con `logger` y el formato
  `[Módulo] Acción: resultado — detalle`.

## Success Criteria

- SC-1: 8 puntos de body crudo migrados a esquema (login, verificar ×3,
  procesar, fallback, consulta ×2) + query de `recuperar/validar`.
- SC-2: 1 solo `=== requireEnv("WORKER_SECRET", 8)` en el código (el helper).
- SC-3: 0 `console.*` en `src/app/api/**/route.ts`.
- SC-4: Tests: 400 con payload inválido y contrato con válido por ruta migrada;
  suite sin regresiones.

## Assumptions

- El frontend solo lee `error.message` de las respuestas no-ok (verificado en
  `src/lib/contexts/AuthContext.tsx:54` y `src/app/registro/page.tsx:27,47,62`):
  conservar mensaje + status basta para no romper la UI.
- Las GET de admin con query params validados a mano (`spam/pendientes`,
  `dataset-entrenamiento`, `anti-abuso/simulacion-score`, `ia/evals/historial`,
  `ia/experimentos/[id]/resultados`, `ciudades`, `departamentos`,
  `config/parametros`, `reportes/mis-reportes`) quedan enumeradas en plan.md
  como deuda; no son públicas ni prioritarias en este bloque.

## Implementación

Cerrada el 2026-07-29 (bloque R6). Detalle completo en `cierre.md`:

- Mecanismo: `src/lib/worker-auth.ts` (única verificación de `x-worker-secret`)
  + 8 esquemas nuevos en `src/lib/validators.ts` — commit `3b62ec5f`.
- 9 puntos migrados a esquema: `auth/login` (`0f9eb8ac`), `auth/verificar` ×3 +
  `auth/recuperar/validar` (`f70ef7c4`), `reportes/procesar` +
  `reportes/fallback` (`dc503bdf`), `consulta` + `consulta/detalle` POST
  tolerantes (`46d20634`). Tests: 3 archivos nuevos + 6 casos añadidos a
  existentes; todos con 400 inválido y contrato válido.
- Logger central en las 30 rutas API que usaban `console.*` (`8919f6f8`).
- Contratos de error del frontend y del worker verificados intactos (ver
  cierre.md § Contratos preservados).
