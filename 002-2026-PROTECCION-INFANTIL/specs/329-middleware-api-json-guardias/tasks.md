# Tasks: Middleware JSON 403 en guardianes para /api/ (SPEC-329)

**Radicado**: 002-PI-229 · 🔴 hotfix · **Branch**: `work/pi-SPEC-329-middleware-api-json-guardias`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Phase 1: Setup

- [x] T001 Crear worktree aislado sobre `origin/main` + `npm ci` propio

## Phase 2: Foundational

- [x] T002 Leer `middleware.ts` línea por línea: confirmar que Paso 2 (auth) ya devuelve JSON 401 para `/api/`, y que Pasos 4/5/6 (consentimiento/cambiar-password/vigencia) hacen `redirect()` para cualquier ruta (candado 15v5)

## Phase 3: US1 — API gateada responde JSON 403 (P1)

**Objetivo**: un cliente que llama `/api/**` estando gateado por estado recibe `403 {error:{message,code,redirectTo}}`, no un 302 HTML.

- [x] T003 [US1] Paso 4 (consentimiento): rama `pathname.startsWith("/api/")` → `NextResponse.json` 403 code `CONSENTIMIENTO_REQUERIDO` en `middleware.ts`
- [x] T004 [US1] Paso 5 (cambio de password): rama api → 403 code `CAMBIO_PASSWORD_REQUERIDO` en `middleware.ts`
- [x] T005 [US1] Paso 6 (vigencia): rama api → 403 code `VIGENCIA_REQUERIDA`, `redirectTo = destinoVigencia(sesion.rol)` en `middleware.ts`

## Phase 4: US2 — Pantallas siguen redirigiendo (contraprueba, P1)

**Objetivo**: rutas no-api (dashboard) conservan el `redirect()` 302 intacto.

- [x] T006 [US2] Verificar que la rama no-api de cada guardián queda idéntica (redirect sin cambios) en `middleware.ts`

## Phase 5: Tests

- [x] T007 [P] `src/middleware-api-guardias.test.ts`: por cada guardián, `POST /api/…` gateado → 403 JSON con `code`; contraprueba `GET /dashboard/…` → 302/307
- [x] T008 Gate local: `tsc` + `lint` + `tokens:check` + `arch:check` + `locks:check` + `ratchets:check` + `specs-discipline.test.ts`

## Phase 6: Cierre

- [x] T009 Fila 329 en `specs/README.md`
- [ ] T010 Commit + push + PR + merge (los ejecuta Fábrica PI-1)
- [ ] T011 Verificación §6b en vivo (curl contra prod) — la cierra el CEO al desplegar

## Dependencias

- T002 antes de T003–T006 (leer fuente antes de tocar).
- T003–T006 antes de T007 (test valida el comportamiento implementado).
- T007–T009 antes de T010.
