# Feature Specification: Ratchet estructural — guardián de vigencia en `middleware.ts` (cierra I-25, I-111, I-141)

**Feature Branch**: `work/002-PI-187` (SPEC-287)
**SPEC**: 287
**Created**: 2026-08-27
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-187-RATCHET-VIGENCIA-MIDDLEWARE · BRIEF-A-26-RATCHET-VIGENCIA-EN-MIDDLEWARE · DIRECTRIZ-004-2026-08-26-2345 · I-25 · I-111 · I-141

Impacto en arquitectura: **estructural — mueve TODOS los guardianes de acceso (sesión, consentimiento, cambio-de-password, vigencia) de los `layout.tsx` de dashboard al nuevo `middleware.ts` en la raíz**. Los layouts quedan como UI puros que renderizan y muestran banners; el middleware es la única capa que puede redirigir. Nueva fuente única `src/lib/routing/guardias.ts`. Se conserva la funcionalidad de CSP con nonce por request (hoy en `src/proxy.ts`, código muerto en runtime porque Next no autodetecta ese nombre) fusionándola en el mismo middleware. Cero cambios al motor IA, cero migraciones.

**Estado del código verificado por 2 caminos (D-004 §1):**
- `x-invoke-path` aparece **exactamente 2 veces** (`padre/layout.tsx:52`, `colegio/layout.tsx:64`). Ambas resuelven `""` en Next 15 App Router — causa raíz confirmada.
- `redirect(` bajo `src/app/dashboard/**/layout.tsx` aparece **16 veces** en 4 archivos: raíz (1), `admin/` (3), `colegio/` (6), `padre/` (6). Todas serán retiradas para satisfacer el ratchet §3.1-2 (ver §Puntos de compuerta).
- Self-redirect `redirect("/dashboard/padre/suscripcion")` en Server Action bajo `/dashboard/**`: **exactamente 1 hit** (`padre/suscripcion/page.tsx:93`). Confirmado.
- `src/proxy.ts` (CSP con nonce) NO es autodetectado como middleware por Next 15 — nombre no convencional (`middleware.ts` en raíz o `src/middleware.ts` son los detectados). Nadie lo importa fuera de tests. Es **código inerte en runtime** hoy, aunque su forma pareciera activarlo. Este frente lo pone realmente en marcha, fusionándolo con los guardianes.

---

## Puntos de compuerta (para audit Fábrica antes de aprobar)

1. **Alcance del ratchet §3.1-2 vs alcance §4 del brief.** El brief §4 dice "Fuera: Layouts de admin/operador/analista". El ratchet §3.1-2 exige `grep redirect( src/app/dashboard/**/layout.tsx = 0`. Choque: `admin/layout.tsx:17,24,31`, `colegio/layout.tsx:33,39,49,55,61,73`, `padre/layout.tsx:27,33,39,45,49,59` y `dashboard/layout.tsx:25` tienen redirects **hoy**. Si respetamos literalmente §4, el ratchet no cabe.  
   **Propuesta adoptada (aplicando la regla estructural del brief §1):** TODOS los guardianes de acceso (sesión, consentimiento, cambio-de-password, vigencia) migran al middleware para TODOS los layouts de `/dashboard/**`. El brief §1 dice explícitamente "los guardianes que redirigen NO deben vivir en el mismo Server Component que renderiza la ruta destino"; esa regla no distingue por rol. Escala moderada: ~11 líneas adicionales de `redirect` a retirar en `admin/layout.tsx` y `dashboard/layout.tsx`, sin lógica nueva. Requiere confirmación Fábrica.

2. **Opción A (cookie firmada `vigencia_estado` TTL 5 min) — adoptada.** Prisma no corre en Edge sin proxy. Las Server Actions de suscripción/renovación/cancelación reescriben la cookie firmada; el middleware la lee y verifica firma HMAC con `JWT_SECRET` (mismo secret que ya existe). En el primer request tras login, si la cookie no está, el middleware la genera consultando via un endpoint interno `POST /api/vigencia/refresh` que corre en Node runtime (no Edge). TTL 5 min: 300 s de riesgo máximo de "estado stale" tras un cambio (aceptable por la naturaleza de la vigencia — no cambia sin acción del usuario).

3. **Matcher del middleware.** `["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]` — cubre todo `/dashboard/**` y `/api/**` menos assets, y evita colisión con la ruta pública `/reportar` que el `src/proxy.ts` viejo listaba aparte (SPEC-287 la incluye en `GUARDIAS_ACCESO.publicas` para que el matcher no la trate distinto).

4. **`src/proxy.ts` (CSP con nonce) se fusiona en `middleware.ts` nuevo.** No se pierde funcionalidad; se elimina la ambigüedad (dos "middlewares" cuando solo uno corre). El `src/proxy.ts` se elimina en la misma SPEC — su código de CSP se traslada íntegro a `middleware.ts` como bloque final que aplica antes de devolver la respuesta.

5. **`src/lib/proxy.ts` (motor de autorización de Server Components) se conserva.** El helper `esDestinoPermitidoPorRol` (importado por 8 componentes de UI para pintar el menú) sigue siendo la referencia para "¿este link es alcanzable para este rol?". Se refactoriza para leer de `GUARDIAS_ACCESO` (fuente única, D-72 reutilizar-no-clonar) en lugar de mantener `PUBLIC_ROUTES` local. Cero cambio funcional; solo la fuente cambia.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Recorrido A A6..A10: el colegio compra suscripción sin bucle (Priority: P1)

`carrillo_franco@hotmail.com` (SCHOOL_ADMIN sin suscripción) entra a la app, es redirigido a `/dashboard/colegio/suscripcion`, ve la lista de planes y activa freemium con un click. La página se re-renderiza en 200 sin `ERR_TOO_MANY_REDIRECTS`. Es el único camino por el que el producto cobra.

**Why this priority**: Sin este fix, el producto no puede cobrar. I-141 lo bloqueó verificablemente hace <24h en `/dashboard/colegio` y `/dashboard/padre`. I-25 e I-111 son la misma clase de fallo con la misma raíz.

**Independent Test**: E2E `loop-colegio.spec.ts` con Playwright — sembrar SCHOOL_ADMIN sin `Suscripcion`, cookie de sesión válida, `page.goto("/dashboard/colegio/suscripcion")`, esperar `response.status() === 200` y `page.url() === baseURL + "/dashboard/colegio/suscripcion"`. Cero 3xx en el camino.

**Acceptance Scenarios**:

1. **Given** SCHOOL_ADMIN sin `Suscripcion`, **When** GET `/dashboard/colegio/suscripcion`, **Then** middleware detecta ruta ∈ `vigencia.SCHOOL_ADMIN.exentas` → `next()` → layout renderiza sin `redirect`. Response 200.
2. **Given** SCHOOL_ADMIN sin `Suscripcion`, **When** GET `/dashboard/colegio` (no exenta), **Then** middleware redirige **una sola vez** a `/dashboard/colegio/suscripcion`; el segundo request ya cae en la ruta exenta.
3. **Given** PARENT sin `Suscripcion`, **When** POST a la Server Action `actionActivarFreemium` en `/dashboard/padre/suscripcion`, **Then** la action ejecuta `revalidatePath` y retorna sin `redirect`; el navegador hace el GET siguiente que el middleware sí exenta (ruta destino) → 200.

### User Story 2 — Cero cambio observable para usuario con vigencia ACTIVA (Priority: P1)

Un padre con `Suscripcion.estado = ACTIVA` navega `/dashboard`, `/dashboard/mis-reportes`, `/dashboard/padre/suscripcion` y `/dashboard/padre/circulo-confianza`. Todo carga exactamente igual que hoy. El middleware pasa transparente. El layout no cambia visualmente.

**Why this priority**: SC-007 del brief. Regresión de UX o de tiempo de respuesta rompería la promesa de "cambio estructural sin cambio observable".

**Independent Test**: Playwright — sembrar PARENT con `Suscripcion.estado = ACTIVA`, navegar las 4 rutas, verificar `status === 200` en todas y que la cookie `vigencia_estado` está firmada con TTL ≤ 5 min.

**Acceptance Scenarios**:

1. **Given** PARENT con vigencia `ACTIVA`, **When** GET `/dashboard/padre`, **Then** middleware pasa (`vigencia[PARENT]` OK), layout renderiza sin redirect y sin banner de "vence pronto".
2. **Given** PARENT con vigencia `EN_GRACIA`, **When** GET `/dashboard/padre`, **Then** middleware pasa (`EN_GRACIA` ∈ estados aceptados), layout muestra banner ámbar "Tu plan vence pronto" (comportamiento actual conservado).
3. **Given** cualquier rol con vigencia ACTIVA, **When** navega libremente, **Then** cookie `vigencia_estado` presente y firmada; cero I/O adicional en Edge por request (la cookie es la fuente de verdad).

### User Story 3 — Los 4 ratchets estáticos impiden que el defecto vuelva a nacer (Priority: P1)

Un desarrollador escribe en `dashboard/padre/nueva-seccion/layout.tsx` un `redirect("/login")` como guardián. El CI falla con mensaje que nombra el archivo y refiere SPEC-287. Otro desarrollador introduce en el mismo layout `(await headers()).get("x-invoke-path")`. El CI también falla. Un tercero declara en `GUARDIAS_ACCESO.vigencia.PARENT.destino = "/dashboard/padre/suscripcion"` pero omite esa URL en `exentas`. El CI también falla.

**Why this priority**: Es el objetivo del brief §3 — que **este defecto no vuelva a nacer**. Sin los ratchets, el fix estructural se degrada al primer PR olvidado.

**Independent Test**: Correr `npm run verificaciones` con violaciones intencionales de cada uno de los 4 ratchets → CI rojo con mensajes específicos.

**Acceptance Scenarios**:

1. **Given** `grep -R "x-invoke-path" src/`, **When** corre `no-x-invoke-path`, **Then** debe devolver 0. Si > 0 → CI rojo.
2. **Given** cualquier `src/app/dashboard/**/layout.tsx`, **When** corre `no-redirect-en-layout-de-dashboard`, **Then** debe ser 0 ocurrencias de `redirect(`. Si > 0 → CI rojo con archivos y líneas.
3. **Given** `page.tsx` bajo `/dashboard/**` con bloque `"use server"`, **When** corre `no-self-redirect-server-actions`, **Then** ninguno puede tener `redirect(<ruta derivada del filesystem>)`. Si aparece → CI rojo con archivo, línea y ruta.
4. **Given** `GUARDIAS_ACCESO`, **When** corre `guardia-invariante`, **Then** por cada `<rol>.destino` la misma URL DEBE estar en `<rol>.exentas`. Si falta → CI rojo con rol y URL.

### User Story 4 — La navegación pública y el login siguen funcionando (Priority: P2)

Usuarios anónimos pueden ver `/`, `/dashboard-publico`, `/seguimiento`, `/reportar`, y llamar a `/api/consulta`. El middleware los pasa sin exigir JWT porque están en `GUARDIAS_ACCESO.publicas` (migrado desde `PUBLIC_ROUTES` en `proxy.ts`). Los tests unitarios existentes de `proxy.test.ts` siguen en verde.

**Why this priority**: Regresión funcional invisible al ojo humano si se pierde una entrada de la migración de PUBLIC_ROUTES.

**Independent Test**: Correr `npm run test:unit`, específicamente `src/lib/proxy.test.ts` — todas las suites siguen verdes tras la refactorización de `esDestinoPermitidoPorRol` para leer de `GUARDIAS_ACCESO`.

**Acceptance Scenarios**:

1. **Given** cliente anónimo, **When** GET `/registro`, **Then** middleware pasa (ruta ∈ `publicas`), Next renderiza la página.
2. **Given** cliente anónimo, **When** GET `/api/reportes`, **Then** middleware pasa, la API responde según su lógica.
3. **Given** SCHOOL_ADMIN con vigencia ACTIVA, **When** navega a `/dashboard-publico`, **Then** llega sin redirect y sin bucle (SPEC-118).

---

## Edge Cases

- **Cookie `vigencia_estado` ausente**: al primer request tras login. El middleware la genera vía POST interno a `/api/vigencia/refresh` (Node runtime, corre Prisma). Si el endpoint falla (BD caída), el middleware **permite acceso** y deja que la página cargue — cerrar acceso por indisponibilidad de infraestructura es peor que permitir un request temporal con vigencia stale.
- **Cookie con firma inválida**: el middleware la ignora, la regenera en el próximo request.
- **Cookie vencida (TTL > 5 min)**: se regenera silenciosamente (revalidación asincrónica en el fondo — el request actual se sirve con la última conocida).
- **Server Action que retorna sin redirect** (post-fix `actionActivarFreemium`): el navegador recibe la respuesta 303 See Other del action y hace GET al `Location` header (Next lo establece a la ruta actual por `revalidatePath`). El GET pasa por el middleware; si la ruta está en `exentas`, `next()`; si no y la vigencia sigue mal, redirige — comportamiento correcto porque la Server Action ya cambió el estado (freemium activado → vigencia ahora ACTIVA → no redirige).
- **PARENT con vigencia CANCELADA que intenta `/dashboard/padre/circulo-confianza`**: middleware detecta `estadoVigencia ∉ {ACTIVA, EN_GRACIA}`, ruta no exenta → redirect a `/dashboard/padre/suscripcion`. Ese GET siguiente sí es exenta → 200. Un solo redirect.
- **Usuario con `debeCambiarPassword=true`**: middleware redirige a `/cambiar-password` antes de evaluar vigencia. La ruta destino está en `GUARDIAS_ACCESO.sesion` (autenticada, exenta de cambio-de-password). Cero bucle.
- **Grep de ratchet 3 vs archivos con `redirect` textual en comentarios**: el ratchet debe filtrar por AST (no matchear `// redirect("...")` ni strings). Falla explícita si el parseo AST falla — no silenciar.
- **`x-invoke-path` en `.md` o comentarios**: el ratchet 1 opera solo sobre `*.ts` y `*.tsx` en `src/`. Ejemplos en `specs/`, `docs/` o comentarios `.md` no lo disparan.
- **Rebase con SPEC-286 (D-3, ya mergeada)**: `proxy.ts` fue tocado (quitar `/consulta` de PUBLIC_ROUTES). La migración de `PUBLIC_ROUTES` a `GUARDIAS_ACCESO.publicas` toma el árbol actual (sin `/consulta`) — cero conflicto porque partimos de HEAD post-merge.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear `middleware.ts` en la raíz de `002-2026-PROTECCION-INFANTIL/` (nombre autodetectado por Next 15 App Router) con Edge runtime.
- **FR-002**: El matcher del middleware DEBE ser `["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]` (patrón oficial Next 15 para "todo menos estáticos"), cubriendo `/dashboard/**` y `/api/**`.
- **FR-003**: El middleware DEBE ejecutar los pasos §2.3 del brief en orden estricto: (a) público → next, (b) sin JWT → redirect login (salvo público), (c) sesión-exenta → next, (d) requiere consentimiento & no está exento → redirect consentimiento, (e) vigencia por rol: exenta → next, estado ∉ {ACTIVA, EN_GRACIA} → redirect destino por rol, (f) next.
- **FR-004**: El sistema DEBE crear `src/lib/routing/guardias.ts` con `export const GUARDIAS_ACCESO` conteniendo `publicas`, `sesion`, `consentimiento: {destino, exentas}` y `vigencia: {PARENT: {destino, exentas}, SCHOOL_ADMIN: {destino, exentas}}`. Por invariante, `<rol>.destino` DEBE estar en `<rol>.exentas`.
- **FR-005**: `GUARDIAS_ACCESO.publicas` DEBE ser la migración exacta de `PUBLIC_ROUTES` de `src/lib/proxy.ts` (fuente única). `src/lib/proxy.ts` DEBE re-exportar `PUBLIC_ROUTES` desde `GUARDIAS_ACCESO.publicas` para no duplicar.
- **FR-006**: `GUARDIAS_ACCESO.sesion` DEBE ser la migración exacta de `SESION_ROUTES` de `src/lib/proxy.ts`. Mismo patrón de re-export.
- **FR-007**: `src/lib/proxy.ts` DEBE seguir exportando `esDestinoPermitidoPorRol` sin cambio funcional (8 componentes UI lo consumen para pintar menús). La única refactorización es reemplazar la lectura interna de `PUBLIC_ROUTES`/`SESION_ROUTES` por la lectura de `GUARDIAS_ACCESO`.
- **FR-008**: El sistema DEBE retirar TODO `redirect(` de `src/app/dashboard/**/layout.tsx` (16 hits verificados: `dashboard/layout.tsx:25`; `admin/layout.tsx:17,24,31`; `colegio/layout.tsx:33,39,49,55,61,73`; `padre/layout.tsx:27,33,39,45,49,59`). Los layouts quedan UI puros.
- **FR-009**: El sistema DEBE retirar `x-invoke-path` de `padre/layout.tsx:52` y `colegio/layout.tsx:64`. Post-fix: `grep -R "x-invoke-path" src/` = 0.
- **FR-010**: `actionActivarFreemium` en `src/app/dashboard/padre/suscripcion/page.tsx:93` DEBE reemplazar `redirect("/dashboard/padre/suscripcion")` por `revalidatePath("/dashboard/padre/suscripcion")` y retornar. NO hay `redirect(<misma ruta>)` residual.
- **FR-011**: El sistema DEBE fusionar la funcionalidad de CSP con nonce (hoy en `src/proxy.ts`, inerte por nombre no autodetectado) dentro del nuevo `middleware.ts`. `src/proxy.ts` se ELIMINA en la misma SPEC.
- **FR-012**: El middleware DEBE consultar el estado de vigencia vía cookie firmada `vigencia_estado` (Opción A del brief §2.4): TTL 5 min, firmada HMAC-SHA256 con `JWT_SECRET`. En ausencia o firma inválida, el middleware llama a `POST /api/vigencia/refresh` (nueva API, Node runtime) que consulta Prisma y devuelve el estado; el middleware setea la cookie y continúa. Cero Prisma en Edge.
- **FR-013**: `POST /api/vigencia/refresh` DEBE ser una nueva API en `src/app/api/vigencia/refresh/route.ts` que reciba el userId del JWT (Node runtime), consulte `PagosRepository.obtenerSuscripcionActivaPorUsuarioId`, y responda `{estado: EstadoVigenciaEfectivo}`.
- **FR-014**: Las Server Actions de suscripción/renovación/cancelación (por radicar en otro frente si aún no existen; en éste, al menos `actionActivarFreemium`) DEBEN escribir/borrar la cookie `vigencia_estado` para invalidar el cache tras cambios.
- **FR-015**: Los 4 ratchets estáticos DEBEN vivir en `scripts/lint/` y correr en el job `verificaciones` del CI: `no-x-invoke-path.ts`, `no-redirect-en-layout-de-dashboard.ts`, `no-self-redirect-server-actions.ts`, `guardia-invariante.ts`. Cada uno con exit ≠ 0 en violación + mensaje humano.
- **FR-016**: Los 2 tests E2E `loop-padre.spec.ts` y `loop-colegio.spec.ts` DEBEN vivir en `tests/e2e/` (patrón existente) y correr en el job `journeys` del CI. Un tercer test verifica que `GET /dashboard/padre` sin vigencia redirige **una sola vez** a `/dashboard/padre/suscripcion` y allí para.
- **FR-017**: NO se toca `src/lib/ai/**`, NO hay migraciones Prisma, NO se rediseña suscripción/cobros/consentimiento (fuera de alcance §4 brief).

### Key Entities

- **`middleware.ts`** (nuevo, raíz): único punto de decisión de acceso + CSP.
- **`GUARDIAS_ACCESO`** (nueva, en `src/lib/routing/guardias.ts`): fuente única de rutas públicas, de sesión, exenciones de consentimiento y exenciones de vigencia por rol.
- **Cookie `vigencia_estado`**: `{estado, iat}` firmado HMAC-SHA256 con `JWT_SECRET`, TTL 5 min.
- **`POST /api/vigencia/refresh`**: nueva API en Node runtime que refresca la cookie.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `test -f middleware.ts` (en la raíz del proyecto) → OK. `grep "matcher" middleware.ts` → aparece el patrón declarado en FR-002.
- **SC-002**: `grep -R "x-invoke-path" src/` → **0 líneas**. Confirmado por 2 caminos (grep + parseo Node de todos los `.ts`/`.tsx`).
- **SC-003**: `grep -R "redirect(" src/app/dashboard --include='layout.tsx'` → **0 líneas**.
- **SC-004**: Los 4 ratchets estáticos corren en `verificaciones` y salen con código 0 sobre el árbol post-fix. Un PR de prueba con violación intencional los hace fallar con mensaje humano — documentado en `cierre.md`, no se mergea.
- **SC-005**: Los 3 tests E2E de `journeys` corren y son verdes: (a) `loop-padre.spec.ts` — PARENT sin vigencia en `/dashboard/padre/suscripcion` → 200 cero redirects; (b) `loop-colegio.spec.ts` — SCHOOL_ADMIN sin vigencia en `/dashboard/colegio/suscripcion` → 200 cero redirects; (c) `redireccion-una-sola-vez.spec.ts` — PARENT sin vigencia en `/dashboard/padre` → un redirect a `/dashboard/padre/suscripcion`, allí para.
- **SC-006**: **Verificación en vivo por Desarrollo**: `carrillo_franco@hotmail.com` (SCHOOL_ADMIN sin suscripción), `curl -sIL` contra `https://localhost/dashboard/colegio/suscripcion` con cookie de sesión → cadena termina en `200`, cero `ERR_TOO_MANY_REDIRECTS`. Reporte con la salida real.
- **SC-007**: Usuario con vigencia ACTIVA — navegación `dashboard`, `dashboard/mis-reportes`, `dashboard/padre/suscripcion` y `dashboard/padre/circulo-confianza`: todos 200, cero redirects. Comportamiento idéntico al pre-fix.
- **SC-008**: Gate LOCAL verde: `tsc --noEmit`, `lint 0 err`, `tokens:check`, `arch:check`, `locks:check`, `test:unit` (incluidos los 4 ratchets + los tests migrados de `proxy.test.ts`).
- **SC-009**: Latencia p95 de middleware < 10 ms por request (cookie firmada — cero I/O). Medido con Playwright/`waitUntil: "commit"`.

---

## Assumptions

- El worktree parte de `origin/feature/001-scaffolding` HEAD (`4381b11d` al momento de la creación, post-merge de SPEC-286).
- `JWT_SECRET` existe como env var en dev/CI/prod (verificado en `src/lib/auth.ts`); se reutiliza para firmar `vigencia_estado`.
- Los 8 componentes UI que hoy importan `esDestinoPermitidoPorRol` de `@/lib/proxy` siguen funcionando sin cambios; la refactorización interna es transparente para ellos.
- Los tests actuales de `src/lib/proxy.test.ts` (244 líneas, ~15 suites) siguen siendo válidos porque el contrato de `esDestinoPermitidoPorRol` y `esRutaPermitidaSchoolAdmin` no cambia.
- La cookie firmada TTL 5 min es aceptable: no hay flujo de vigencia que dependa de propagación sub-5-min (el usuario ve cambios tras su siguiente request; en el peor caso navega 5 min con estado stale que no bloquea, solo puede permitir un GET adicional al dashboard tras cancelar — nadie explota eso).
- El endpoint `/api/vigencia/refresh` va en Node runtime (default de Next); Prisma corre allí.
- `src/proxy.ts` (hoy inerte) se elimina sin ceremonia adicional — nadie lo importa fuera de sí mismo.
- El comentario sobre CSP en `next.config.ts:72` que refiere a `src/proxy.ts` se actualiza a `middleware.ts`.
- Los layouts admin, dashboard raíz y colegio pierden líneas de `redirect` pero conservan su función UI. Sus tests visuales existentes (si los hay) siguen verdes.
- CERO cambios en `src/lib/ai/**`, cero migraciones, alcance según brief §4 ampliado por el Punto de compuerta 1 (validado por Fábrica antes de implementar).
