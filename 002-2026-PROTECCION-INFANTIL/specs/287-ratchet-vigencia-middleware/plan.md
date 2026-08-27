# Implementation Plan: Ratchet estructural — guardián de vigencia en `middleware.ts` (cierra I-25, I-111, I-141)

**Branch**: `work/002-PI-187` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-187 · BRIEF-A-26 · DIRECTRIZ-004 · I-25/I-111/I-141

---

## Summary

Cerrar la clase de fallo I-25 → I-111 → I-141 (tres apariciones del mismo defecto en 4 meses) moviendo TODOS los guardianes de acceso al nuevo `middleware.ts` en la raíz. Los layouts `dashboard/**/layout.tsx` quedan UI puros. Fuente única `src/lib/routing/guardias.ts` compartida por middleware, `src/lib/proxy.ts` (autorización de Server Components) y tests. Opción A adoptada para vigencia en Edge (cookie firmada TTL 5 min). Se fusiona el CSP con nonce (hoy en `src/proxy.ts` inerte porque Next no autodetecta ese nombre) dentro del nuevo `middleware.ts`. 4 ratchets estáticos + 3 tests E2E aseguran que el defecto no vuelva a nacer. Cero cambios al motor IA, cero migraciones.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 15 App Router · TypeScript 5 · Edge runtime para middleware · Node runtime para `/api/vigencia/refresh` |
| **Runtime de la cookie** | HMAC-SHA256 vía `jose` (ya en el proyecto para JWTs) con `JWT_SECRET` |
| **Testing** | Vitest para unit + ratchets · Playwright para E2E (patrón existente en `tests/e2e/`) |
| **Rendimiento** | Middleware p95 < 10 ms (cookie firmada, cero I/O). Refresh cookie: llamada asincrónica a `/api/vigencia/refresh` (Node) ~50-100 ms — solo en primer request tras login o TTL expirado. |
| **Constraints** | Cero cambios al motor · cero migraciones · cero cambio observable para usuario con vigencia ACTIVA · cero pérdida de funcionalidad CSP con nonce |
| **Autonomía** | Régimen D-51: build → PR → gate CI → auditoría Fábrica → deploy Jelkin → verificación en vivo obligatoria (SC-006) |

---

## Constitution Check

- ✅ **Solo texto** — irrelevante.
- ✅ **IA local** — irrelevante; no toca motor.
- ✅ **Migraciones aditivas y no destructivas** — CERO migraciones.
- ✅ **Frontera DAL (Q-3)** — el nuevo endpoint `/api/vigencia/refresh` corre en Node runtime y consulta vía `PagosRepository`. El middleware NO importa Prisma.
- ✅ **Sin `any` ni stack traces al cliente** — funciones nuevas tipadas estrictamente.
- ✅ **Un solo commit por User Story + uno de docs** — plan §Commit map documenta el mapa (6 commits).

Sin violaciones. `Complexity Tracking` no aplica.

---

## Project Structure

### Documentation (this feature)

```text
specs/287-ratchet-vigencia-middleware/
├── plan.md              # Este archivo
├── spec.md              # ya creado
└── tasks.md             # Fase 2 (a producir con /speckit.tasks)
```

### Código a tocar (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── middleware.ts                                          # NUEVO (raíz) — único punto de decisión + CSP con nonce
├── src/lib/routing/
│   ├── guardias.ts                                        # NUEVO — fuente única GUARDIAS_ACCESO
│   ├── vigencia-cookie.ts                                 # NUEVO — firmar/verificar/leer cookie vigencia_estado
│   └── guardias.test.ts                                   # NUEVO — unit del invariante destino ∈ exentas + tabla
├── src/lib/proxy.ts                                       # REFACTOR — PUBLIC_ROUTES/SESION_ROUTES leen de GUARDIAS_ACCESO
├── src/proxy.ts                                           # ELIMINAR — CSP con nonce fusionado en middleware.ts
├── src/app/dashboard/layout.tsx                           # REFACTOR — quitar redirect("/consentimiento") y toda lógica de guarda
├── src/app/dashboard/admin/layout.tsx                     # REFACTOR — quitar 3 redirects (sesión + permisos + cambiar-password)
├── src/app/dashboard/colegio/layout.tsx                   # REFACTOR — quitar 6 redirects + x-invoke-path; queda UI puro con banner
├── src/app/dashboard/padre/layout.tsx                     # REFACTOR — quitar 6 redirects + x-invoke-path; queda UI puro con banner
├── src/app/dashboard/padre/suscripcion/page.tsx           # REFACTOR — actionActivarFreemium: quitar redirect, dejar revalidatePath
├── src/app/api/vigencia/refresh/
│   ├── route.ts                                           # NUEVO — POST refresca cookie (Node runtime)
│   └── route.test.ts                                      # NUEVO — unit del endpoint
├── scripts/lint/
│   ├── no-x-invoke-path.ts                                # NUEVO — ratchet 1
│   ├── no-redirect-en-layout-de-dashboard.ts              # NUEVO — ratchet 2
│   ├── no-self-redirect-server-actions.ts                 # NUEVO — ratchet 3
│   ├── guardia-invariante.ts                              # NUEVO — ratchet 4
│   └── *.test.ts                                          # NUEVO — 4 tests unit de los ratchets
├── tests/e2e/
│   ├── loop-padre.spec.ts                                 # NUEVO — E2E ratchet vs I-141
│   ├── loop-colegio.spec.ts                               # NUEVO — E2E ratchet vs I-141
│   └── redireccion-una-sola-vez.spec.ts                   # NUEVO — E2E "un solo redirect"
├── .github/workflows/ci.yml                               # AGREGAR pasos: 4 ratchets en `verificaciones` + confirmar E2E ya cubierta
├── next.config.ts                                         # ACTUALIZAR comentario en L72 (src/proxy.ts → middleware.ts)
├── package.json                                           # AGREGAR scripts: ratchets:x-invoke, ratchets:redirect-layout, ratchets:self-redirect, ratchets:guardia-invariante (o wrapper `ratchets:check`)
└── specs/287-ratchet-vigencia-middleware/
```

**Structure Decision**: monolito Next.js del PI. Un solo middleware Edge en la raíz (patrón oficial Next 15). Ratchets en `scripts/lint/` (patrón consistente con `scripts/tokens-check.ts`, `scripts/locks-check.ts`, `scripts/arch/`). E2E en `tests/e2e/` (patrón consistente con los journeys existentes).

---

## Implementation Steps (orden estricto §3.3 brief · no negociable)

### Fase 0 — Barrido D-004 §1 (ya hecho, documentado en spec §Puntos de compuerta)

`x-invoke-path` = 2 hits · `redirect(` layouts dashboard = 16 hits · self-redirect actions = 1 hit. Confirmado por grep + parseo Node.

### Fase 1 — Fuente única `GUARDIAS_ACCESO` + cookie firmada

1. **`src/lib/routing/guardias.ts`**: definir `GUARDIAS_ACCESO` con `publicas`, `sesion`, `consentimiento`, `vigencia` (PARENT + SCHOOL_ADMIN). Invariante `<rol>.destino ∈ <rol>.exentas` verificado en runtime (assertion en `import` — falla al arranque si mal).
2. **`src/lib/routing/vigencia-cookie.ts`**: `firmarVigencia(estado, secret)` → `string`; `leerVigencia(cookieValue, secret, maxAgeSec)` → `{estado, iat} | null`. HMAC-SHA256 vía `jose`.
3. **`src/lib/routing/guardias.test.ts`**: unit del invariante, unit de cookie (firma/verificación/TTL/tampering).

### Fase 2 — Middleware.ts + refresh API

4. **`middleware.ts`** (raíz): implementar los 6 pasos del brief §2.3 en Edge runtime. Al final, aplicar CSP con nonce (bloque migrado desde `src/proxy.ts`). Matcher declarado según FR-002.
5. **`src/app/api/vigencia/refresh/route.ts`**: POST que recibe request con JWT válido (verificar aquí también), consulta `PagosRepository`, responde `{estado}`. Node runtime explícito (default).
6. **`src/app/api/vigencia/refresh/route.test.ts`**: unit — usuario sin suscripción → `SIN_SUSCRIPCION`; usuario ACTIVA → `ACTIVA`; sin JWT → 401.

### Fase 3 — Retirar guardianes de layouts + fix Server Action

7. **`src/app/dashboard/padre/layout.tsx`**: quitar imports de `redirect`, `verifyToken`, `PagosRepository`, `requiereConsentimientoActual`, `resolverEstadoVigencia`, `esRutaExenta`, `redireccionSuscripcion`, `headers`. Conservar: `UsuarioRepository` para leer datos del usuario para el sidebar; `debeMostrarBanner` para el banner "vence pronto"; `PadreSideNav`, `Alerta`. La lógica queda: leer usuario (via cookie que el middleware ya validó), calcular banner, renderizar. Cero `redirect`.
8. **`src/app/dashboard/colegio/layout.tsx`**: análogo. Conservar `modulosPermitidosParaRol`, `ColegioSideNav`, `BuscadorGlobal`, `CentroNotificaciones`, banner.
9. **`src/app/dashboard/layout.tsx`** (raíz): quitar `redirect("/consentimiento")` y toda la lógica de guarda (líneas 15-33). Queda como `SessionPingProvider` + `<div>{children}</div>`. `verificarVigenciaCliente` deja de usarse (posible dead code — grep post-fix; si nadie más lo usa, se elimina en el mismo commit).
10. **`src/app/dashboard/admin/layout.tsx`**: quitar los 3 `redirect` (sesión, permisos, cambiar-password). Queda como sidebar admin puro. El middleware ya bloqueó a no-admins antes de llegar aquí (matcher cubre `/dashboard/**`).
11. **`src/app/dashboard/padre/suscripcion/page.tsx:93`**: cambiar `redirect("/dashboard/padre/suscripcion");` por nada — la línea 92 `revalidatePath("/dashboard/padre/suscripcion");` ya hace lo necesario. La action retorna implícitamente `void`.
12. Grep post-fase: `grep -R "x-invoke-path" src/` = 0; `grep "redirect(" src/app/dashboard/**/layout.tsx` = 0; `grep 'redirect("/dashboard/padre/suscripcion")' src/app/dashboard/**/*.tsx` = 0.

### Fase 4 — Refactor de `src/lib/proxy.ts` para leer GUARDIAS_ACCESO

13. **`src/lib/proxy.ts`**: eliminar `const PUBLIC_ROUTES = [...]` y `const SESION_ROUTES = [...]` locales. Re-exportar desde `GUARDIAS_ACCESO`. El resto del archivo (`esDestinoPermitidoPorRol`, `esRutaPermitidaSchoolAdmin`, `proxy`) no cambia funcionalmente.
14. Verificar que los 8 componentes UI que importan `esDestinoPermitidoPorRol` siguen compilando (grep automático).

### Fase 5 — Eliminar `src/proxy.ts` (inerte) + actualizar next.config.ts

15. **`src/proxy.ts`**: borrar el archivo.
16. **`next.config.ts:72`**: actualizar comentario `src/proxy.ts` → `middleware.ts`.

### Fase 6 — 4 ratchets estáticos

17. **`scripts/lint/no-x-invoke-path.ts`**: grep sobre `src/**/*.{ts,tsx}`, exit ≠ 0 si > 0 ocurrencias, con archivo + línea.
18. **`scripts/lint/no-redirect-en-layout-de-dashboard.ts`**: parseo TS AST (usando `typescript` compilerAPI del proyecto) sobre `src/app/dashboard/**/layout.tsx`; si hay `CallExpression` cuyo callee es `Identifier("redirect")`, falla.
19. **`scripts/lint/no-self-redirect-server-actions.ts`**: para cada `page.tsx` bajo `src/app/dashboard/**`, derivar ruta URL del filesystem (`padre/suscripcion/page.tsx` → `/dashboard/padre/suscripcion`); dentro de cada bloque `"use server"` (function con esa directiva), buscar `redirect(<ruta derivada>)` textual; fallar si aparece.
20. **`scripts/lint/guardia-invariante.ts`**: `import { GUARDIAS_ACCESO } from "../../src/lib/routing/guardias"`; para cada rol en `vigencia`, verificar `destino ∈ exentas`; fallar si no.
21. **`scripts/lint/*.test.ts`**: unit de cada ratchet (fixtures sintéticos con violación → exit ≠ 0; caso feliz → exit 0).
22. **`package.json`**: agregar `"ratchets:check": "npm-run-all -p ratchets:*"` + los 4 scripts individuales.
23. **`.github/workflows/ci.yml`**: en job `verificaciones` tras `locks:check`, agregar `- run: npm run ratchets:check`.

### Fase 7 — Tests E2E (Playwright)

24. **`tests/e2e/loop-padre.spec.ts`**: sembrar PARENT sin `Suscripcion`, cookie sesión, `page.goto("/dashboard/padre/suscripcion", {waitUntil: "commit"})`; `expect(response.status()).toBe(200)`; `expect(page.url()).toBe(baseURL + "/dashboard/padre/suscripcion")`; no debe haber navegación intermedia.
25. **`tests/e2e/loop-colegio.spec.ts`**: análogo para SCHOOL_ADMIN.
26. **`tests/e2e/redireccion-una-sola-vez.spec.ts`**: PARENT sin `Suscripcion`, `page.goto("/dashboard/padre")`; el listener de `page.on("framenavigated")` debe capturar exactamente 2 URLs (la original + `/dashboard/padre/suscripcion`), no más.

### Fase 8 — Gate LOCAL + gate E2E local

27. `npx tsc --noEmit`
28. `npm run lint` (0 errores)
29. `npm run tokens:check`
30. `npm run arch:check`
31. `npm run locks:check`
32. `npm run ratchets:check` (4/4 verdes)
33. `npm run test:unit` (incluye los tests de ratchets + guardias + vigencia-cookie + refresh API + los existentes de proxy.test.ts intactos)
34. **`npm run test:journeys` (los 3 E2E de bucle en local — no se abre PR sin esto)**

### Fase 9 — Gate pre-push + push

35. `git fetch origin && git rebase origin/feature/001-scaffolding`
36. `git diff --name-status origin/feature/001-scaffolding..HEAD` — verificar solo archivos SPEC-287. Si aparece uno ajeno → HALLAZGO · PARA.
37. `git push origin work/002-PI-187`.

### Fase 10 — PR + CI + merge

38. Fábrica abre PR y mergea cuando CI cierre verde 11/11.

### Fase 11 — Verificación en vivo obligatoria (SC-006)

39. Levantar app en local (`./scripts/dev-restart.sh` o docker compose local).
40. Sembrar/usar `carrillo_franco@hotmail.com` (SCHOOL_ADMIN sin suscripción). Cookie de sesión válida.
41. `curl -sIL -b "cookies.txt" https://localhost/dashboard/colegio/suscripcion | head -30` → verificar que la cadena termina en `200` sobre `/dashboard/colegio/suscripcion` (no `ERR_TOO_MANY_REDIRECTS`, no 3xx en cadena).
42. Reportar bitácora corta con los tres números: status final, cantidad de redirects intermedios, URL final.

### Commit map (español, imperativo, un cambio lógico = un commit)

- `docs(spec-kit): SPEC-287 · spec + plan · ratchet estructural guardián en middleware.ts (I-25/I-111/I-141) [002-PI-187]`
- `feat(routing): GUARDIAS_ACCESO como fuente única + cookie firmada vigencia_estado [SPEC-287]`
- `feat(middleware): nuevo middleware.ts (guardianes + CSP con nonce fusionado) + POST /api/vigencia/refresh [SPEC-287]`
- `refactor(dashboard): layouts UI puros (retirar redirects + x-invoke-path) + fix actionActivarFreemium [SPEC-287]`
- `refactor(proxy): PUBLIC_ROUTES/SESION_ROUTES leen de GUARDIAS_ACCESO + eliminar src/proxy.ts inerte [SPEC-287]`
- `feat(ratchets): 4 ratchets estáticos anti-recaída + 3 E2E de bucle [SPEC-287]`

---

## Test Strategy

- **Unit (Vitest)**:
  - `guardias.test.ts` — invariante `destino ∈ exentas` para cada rol.
  - `vigencia-cookie.test.ts` — firma/verificación/tampering/TTL vencido.
  - `api/vigencia/refresh/route.test.ts` — 3 casos: sin sesión, sin suscripción, con ACTIVA.
  - `scripts/lint/*.test.ts` — 4 tests, uno por ratchet, con fixtures sintéticos.
  - `src/lib/proxy.test.ts` (existente) — sigue en verde tras la refactorización.
- **Integración**: `/api/vigencia/refresh` con BD real (Vitest integration si aplica).
- **E2E (Playwright, job `journeys`)**: 3 tests que reproducen exactamente el bucle de I-141 y verifican que no ocurre. Correr en local antes de push.
- **Verificación en vivo (SC-006)**: obligatoria. Reporte con `curl -sIL` y bitácora corta.

---

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| Middleware Edge no puede consultar Prisma → cookie firmada mal implementada deja pasar accesos indebidos. | Firma HMAC-SHA256 con `JWT_SECRET`; verificación estricta en cada request; TTL 5 min limita ventana de estado stale; endpoint `/api/vigencia/refresh` es la única fuente de verdad que consulta BD. Tests unit cubren tampering, firma inválida, TTL vencido. |
| Al retirar `redirect("/login")` de `admin/layout.tsx`, un usuario ADMIN con token inválido llega a la página y ve error 500 en vez de login. | El middleware bloquea antes (paso 2: sin JWT válido → redirect login). El layout ya recibe usuario autenticado; se conserva la lectura de `usuario` para el sidebar pero sin `redirect`. Test E2E: navegación anónima a `/dashboard/admin/*` → 307 al login. |
| Refactor de `src/lib/proxy.ts` rompe algún consumidor UI. | 8 componentes importan `esDestinoPermitidoPorRol` — refactorización interna es transparente (misma firma, mismo comportamiento). Tests de `proxy.test.ts` cubren la superficie. |
| Cookie `vigencia_estado` no se invalida tras `actionActivarFreemium`. | La action llama a helper que borra la cookie (`res.cookies.delete("vigencia_estado")`); el siguiente request regenera cookie con estado nuevo vía `/api/vigencia/refresh`. Cubierto por E2E (activar freemium → siguiente GET al dashboard responde 200 con vigencia ACTIVA). |
| Ratchet 3 (`no-self-redirect-server-actions`) tiene falsos positivos por match textual en comentarios/strings. | Usa parseo AST TypeScript, no grep; solo inspecciona `CallExpression` dentro de funciones marcadas `"use server"`. Tests unit del ratchet cubren edge cases (redirect en comentario, redirect en string literal). |
| Rebase con SPEC-286 (D-3 mergeada) crea conflicto en `proxy.ts`. | Partimos de HEAD post-merge (`4381b11d`); la migración de `PUBLIC_ROUTES` a `GUARDIAS_ACCESO` toma el árbol actual sin `/consulta`. Cero conflicto esperado. |
| Los 3 E2E de bucle dependen de sembrar usuario+suscripción → fixture frágil. | Reutilizar helpers `sembrarUsuarioSinVigencia` (si existen) o crearlos en `tests/e2e/helpers/`. Los tests corren en el CI journeys job con BD efímera. Cero flake si la siembra es idempotente. |
| CSP con nonce se pierde en la fusión. | El código de `src/proxy.ts` (líneas 52-77) se traslada íntegro al final del `middleware.ts`; test manual: `curl -I https://localhost/dashboard/colegio/suscripcion | grep Content-Security-Policy` — debe seguir apareciendo con `nonce-<v>`. |

---

## Out of Scope

- Rediseño del flujo de suscripción, cobros, muro de consentimiento (§4 brief).
- Cambios al motor `src/lib/ai/**`. Prohibido.
- Cambios a Prisma / schema / migraciones. Cero.
- Levantar `worker-sesiones` (D-004 §2, aparte).
- Ficha de colegio del admin (A-23, aparte).
- Layouts de operador/analista si no tienen `redirect` (verificado: solo `admin/layout.tsx` los tiene bajo dashboard/).
- Cambios a `esDestinoPermitidoPorRol` semánticamente (solo su fuente de datos).
- Ampliar el matcher del middleware a rutas fuera de `/dashboard`/`/api` (out of scope: la landing y públicas no requieren middleware nuevo).
