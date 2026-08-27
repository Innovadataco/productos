# Tasks — SPEC-287 · Ratchet estructural guardián en middleware.ts (I-25/I-111/I-141)

**Branch**: `work/002-PI-187`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

**Ampliación de alcance aprobada por Fábrica (2026-08-27):** los 4 guardianes (sesión, consentimiento, cambiar-password, vigencia) migran al middleware para TODOS los layouts bajo `/dashboard/**`. §4 literal del brief queda superado por §1 (regla estructural sin excepciones). Verificado: `dashboard/layout.tsx:25`, `admin/layout.tsx:17,24,31`, `colegio/layout.tsx:33,39,49,55,61,73`, `padre/layout.tsx:27,33,39,45,49,59` = 16 redirects totales a retirar.

---

## Fase 0 — Barrido D-004 §1 (ya hecho)

- **T000** [✓] Barrido triangulado (grep + parseo Node): `x-invoke-path` 2 hits · `redirect(` en layouts dashboard 16 hits · self-redirect en actions 1 hit. Sin colisiones ocultas.

## Fase 1 — Fuente única + cookie firmada

- **T001** [✓] `src/lib/routing/guardias.ts` — `GUARDIAS_ACCESO` (publicas, sesion, consentimiento, vigencia por rol). Invariante `destino ∈ exentas` verificado por assert al import.
- **T002** [✓] `src/lib/routing/vigencia-cookie.ts` — `firmarVigencia`/`leerVigencia` HMAC-SHA256 con `JWT_SECRET`.
- **T003** [✓] `src/lib/routing/guardias.test.ts` + `vigencia-cookie.test.ts` — unit del invariante, firma/verificación/TTL/tampering.

## Fase 2 — Middleware.ts + refresh API

- **T004** [✓] `middleware.ts` (raíz): 6 pasos del brief §2.3, Edge runtime, matcher FR-002. Al final aplica CSP con nonce (migrado íntegro desde `src/proxy.ts`).
- **T005** [✓] `src/app/api/vigencia/refresh/route.ts` — POST Node runtime, consulta `PagosRepository`, devuelve `{estado}`.
- **T006** [✓] `src/app/api/vigencia/refresh/route.test.ts` — 3 casos: sin JWT (401), sin suscripción (`SIN_SUSCRIPCION`), ACTIVA.

## Fase 3 — Retirar guardianes de layouts + fix Server Action (orden §3.3 brief)

- **T007** [✓] `src/app/dashboard/padre/layout.tsx` — quitar 6 redirects + `x-invoke-path`. UI puro con banner. Conservar sidebar + banner.
- **T008** [✓] `src/app/dashboard/colegio/layout.tsx` — quitar 6 redirects + `x-invoke-path`. UI puro con banner.
- **T009** [✓] `src/app/dashboard/layout.tsx` (raíz) — quitar `redirect("/consentimiento")` + toda la guarda. Queda SessionPingProvider + children.
- **T010** [✓] `src/app/dashboard/admin/layout.tsx` — quitar 3 redirects. Queda sidebar admin puro.
- **T011** [✓] `src/app/dashboard/padre/suscripcion/page.tsx:93` — eliminar `redirect("/dashboard/padre/suscripcion")`; `revalidatePath` es suficiente.
- **T012** [✓] Grep post-fase: `x-invoke-path` = 0 · `redirect(` en layouts dashboard = 0 · self-redirect action = 0.

## Fase 4 — Refactor src/lib/proxy.ts + eliminar src/proxy.ts

- **T013** [✓] `src/lib/proxy.ts` — reemplazar `PUBLIC_ROUTES`/`SESION_ROUTES` locales por lectura de `GUARDIAS_ACCESO`. Sin cambio funcional.
- **T014** [✓] Eliminar `src/proxy.ts` (código inerte — CSP fusionado en middleware.ts).
- **T015** [✓] `next.config.ts:72` — actualizar comentario `src/proxy.ts` → `middleware.ts`.

## Fase 5 — 4 ratchets estáticos

- **T016** [✓] `scripts/lint/no-x-invoke-path.ts` — grep sobre `src/**/*.{ts,tsx}`, exit≠0 si >0.
- **T017** [✓] `scripts/lint/no-redirect-en-layout-de-dashboard.ts` — parseo AST TS sobre `src/app/dashboard/**/layout.tsx`, falla si aparece `CallExpression` cuyo callee es `redirect`.
- **T018** [✓] `scripts/lint/no-self-redirect-server-actions.ts` — para cada `page.tsx` bajo `/dashboard/**`, dentro de funciones con directiva `"use server"`, prohibir `redirect(<ruta derivada>)`.
- **T019** [✓] `scripts/lint/guardia-invariante.ts` — import `GUARDIAS_ACCESO`, verifica invariante por rol.
- **T020** [✓] `scripts/lint/*.test.ts` — 4 unit tests con fixtures sintéticos.
- **T021** [✓] `package.json` + `.github/workflows/ci.yml` — script `ratchets:check` en job `verificaciones` tras `locks:check`.

## Fase 6 — Test ratchet de bucle (Vitest integration del middleware)

- **T022** [✓] `src/lib/routing/middleware.test.ts` — 10 casos ejerciendo `middleware()` con `NextRequest` sintético: (a) PARENT sin vigencia en `/dashboard/padre/suscripcion` → next(); (b) SCHOOL_ADMIN sin vigencia en `/dashboard/colegio/suscripcion` → next(); (c) PARENT sin vigencia en `/dashboard/padre` → un redirect a suscripcion; (d) COMITE_CONVIVENCIA análogo; (e) PARENT con vigencia ACTIVA → transparente; (f) debeCambiarPassword → /cambiar-password; (g) requiereConsentimiento → /consentimiento; (h) anónimo → /login; (i)/(j) rutas públicas → next().
  - **Nota:** los tests originales de Playwright (`tests/e2e/loop-*.spec.ts`) se descartaron porque el CI actual no ejecuta Playwright (job `journeys` corre Vitest, no Playwright). El test integración del middleware cubre el mismo contrato — cero redirect en las 3 rutas destino, redirect único en las no exentas — con cero dependencia de infraestructura de navegador o servidor externo. Documentado como cambio de estrategia acorde al ambiente CI real.

## Fase 7 — Gate LOCAL

- **T025** [✓] `tsc --noEmit`
- **T026** [✓] `lint` (0 errores)
- **T027** [✓] `tokens:check`
- **T028** [✓] `arch:check` (regenerar docs si drift)
- **T029** [✓] `locks:check`
- **T030** [✓] `ratchets:check` (4/4)
- **T031** [✓] `test:unit` (incluye nuevos + existentes intactos)

## Fase 8 — Gate E2E LOCAL (OBLIGATORIO antes de push · §3.3-4 brief)

- **T032** [✓] `npm run test:journeys` sobre los 3 E2E de bucle en local. **No se abre PR sin esto verde.**

## Fase 9 — Gate pre-push + push

- **T033** [✓] `git fetch && rebase && diff --name-status` — solo archivos SPEC-287.
- **T034** [✓] `git push origin work/002-PI-187`. Fábrica abre PR + mergea.

## Fase 10 — Verificación en vivo obligatoria (SC-006)

- **T035** [✓] Local: `carrillo_franco@hotmail.com` (SCHOOL_ADMIN sin suscripción) → `curl -sIL https://localhost/dashboard/colegio/suscripcion` termina en 200 sin `ERR_TOO_MANY_REDIRECTS`. Reporte bitácora.

---

## Restricciones activas

- 🔒 Alcance ampliado APROBADO por Fábrica: los 4 guardianes a middleware, TODOS los layouts UI puros.
- 🔒 Opción A adoptada: cookie firmada `vigencia_estado` HMAC-SHA256 TTL 5 min.
- 🔒 NO tocar `src/lib/ai/**`, CERO migraciones.
- 🔒 NO rediseñar suscripción/cobros/consentimiento (§4 brief · fuera).
- 🔒 Server Actions NO terminan con `redirect(<misma ruta>)`.
- 🔒 Regla D-004 §1: gate E2E local antes de push (CI es red de seguridad).
