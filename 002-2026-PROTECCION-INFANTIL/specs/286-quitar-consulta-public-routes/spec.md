# Feature Specification: Quitar `/consulta` de PUBLIC_ROUTES (cierra I-136)

**Feature Branch**: `work/002-PI-186` (SPEC-286)
**SPEC**: 286
**Created**: 2026-08-26
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-186-QUITAR-CONSULTA-PUBLIC-ROUTES · REPORTE-003-2026-08-26-2230 §3.2 · DIRECTRIZ-002-2026-08-26-2000 §3.2 · I-136 (patrón compartido con I-35, I-110, I-111)

Impacto en arquitectura: **cero** más allá de sacar una línea muerta. `/consulta` está declarada como pública en `src/lib/proxy.ts:13` pero **no existe** como página en `src/app/`; la consulta pública real vive en el home `/`. Quitarla cierra una entrada declarada pero rota — el mismo tipo de superficie que mordió I-35, I-110 e I-111. Se conserva la línea `/api/consulta` en las otras allowlists porque esa API sí existe y la consume el formulario del home.

**Hallazgo previo (D-37 + patrón proxy):** el INSTRUCTIVO §Criterios de auditoría indica que `/consulta` responde `404 (no 200 ni 307)` sin sesión tras el fix. **Eso no coincide con el comportamiento real del proxy**: al dejar de estar en `PUBLIC_ROUTES`, la ruta cae al catch-all de rutas privadas y el proxy responde `307 → /login` (patrón `redirectToLogin` en `src/lib/proxy.ts:205`, idéntico al que aplica a `/dashboard` cuando el usuario es anónimo — ver `proxy.test.ts:202-206`). La ruta ya no será alcanzable como página huérfana — que es el objetivo real de cerrar I-136 — pero el estado HTTP visible pasa de `404` a `307`. Se documenta explícitamente en SC-002 y en Assumptions; la verificación en vivo se redacta acorde.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cerrar la puerta declarada pero muerta (Priority: P1)

Un atacante o auditor barre las rutas públicas del sitio en busca de superficie de ataque. Antes del fix, `GET /consulta` devuelve `404` pero aparece como pública en el proxy — una entrada declarada, sin dueño, ambigua para quien lee el código. Tras el fix, la ruta ya no está declarada como pública: sin sesión, el proxy responde `307 → /login`; con sesión, el flujo por rol decide si es alcanzable (para ningún rol conocido lo es porque la página no existe, y aterrizan en su home).

**Why this priority**: Es el único motivo del frente. I-136 apunta específicamente a este tipo de deuda visual en el proxy, que ya causó tres incidencias severas (I-35, I-110, I-111) por decisiones tomadas sobre allowlists inconsistentes.

**Independent Test**: Correr el test nuevo del proxy `sin sesión → /consulta debe redirigir a /login`; correr el guard existente `LandingHero.test.tsx:90-94` que verifica que la landing no linkea a `/consulta`; correr el guard existente `url-privacy.test.ts:48` que verifica que la página no existe (404) en tiempo de test.

**Acceptance Scenarios**:

1. **Given** `/consulta` retirada de `PUBLIC_ROUTES`, **When** un cliente anónimo hace `GET /consulta`, **Then** el proxy retorna `307` con `Location: /login`.
2. **Given** la misma ruta retirada, **When** los tests del proxy corren, **Then** el nuevo caso de regresión (`/consulta` sin sesión → redirect a login) pasa en verde.
3. **Given** el fix aplicado, **When** un rol autenticado alcanza `/consulta`, **Then** aterriza en su home por rol (patrón `homeForRole`, existente).

### User Story 2 — La API `/api/consulta` sigue funcionando (Priority: P1)

El formulario de consulta del home (`ConsultaPublica.tsx:18`, `MisReportesList.tsx:69`) hace `fetch("/api/consulta", {...})`. La API vive en `src/app/api/consulta/route.ts` y sigue siendo pública (línea `/api/consulta` en `PUBLIC_ROUTES:25`, no se toca). Este frente no puede romperla.

**Why this priority**: Sería una regresión invisible al ojo humano (una API pública que deja de responder). El barrido D-37 identificó todas sus llamadas para confirmar que no dependen de `/consulta` (página) sino de `/api/consulta` (API).

**Independent Test**: `src/app/api/consulta/route.test.ts` (existente) sigue pasando en verde; ningún test se rompe.

**Acceptance Scenarios**:

1. **Given** el fix aplicado, **When** el suite de tests unitarios corre, **Then** los tests de `route.ts`, `route-f3.test.ts`, `detalle/route.test.ts` y `evento/route.test.ts` no se ven afectados.
2. **Given** el fix aplicado, **When** el suite del proxy corre, **Then** `/api/consulta` sigue clasificándose como pública (via línea `src/lib/proxy.ts:25`, no tocada).

---

## Edge Cases

- **Barrido D-37 realizado (documentado en la señal spec+plan LISTO):**
  - Como string literal `"/consulta"`: 3 ocurrencias — todas legítimas: `proxy.ts:13` (target del fix), `proxy.ts:77` (comentario que documenta la razón), `LandingHero.test.tsx:94` (guard que verifica NO existe link).
  - Como href: cero ocurrencias.
  - Referencias a `/api/consulta*`: numerosas y legítimas (API viva, se conservan).
  - Referencias en `url-privacy.test.ts`: 3 (líneas 7, 18, 48) — guards que verifican que la página no existe. Se conservan.
  - **Cero usos vivos como página.** Se puede quitar.
- **Comentario en `proxy.ts:77-78`** que explica *"/consulta" no existe como página*: se **conserva** — sigue siendo verdad y ahora refuerza la coherencia del código.
- **Guard `LandingHero.test.tsx:90-94`**: se conserva sin cambios. Refuerza el fix; si algún día alguien vuelve a linkear a `/consulta` desde la landing, ese test falla.
- **Guard `url-privacy.test.ts:48`**: se conserva sin cambios. Ya verifica que la página no existe.
- **Estado HTTP post-fix:** `307 → /login` sin sesión, no `404`. Esto discrepa del texto del INSTRUCTIVO pero es el comportamiento real del proxy, y es correcto — cierra la superficie declarada aunque el status change.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE eliminar la línea `"/consulta",` de `PUBLIC_ROUTES` en `src/lib/proxy.ts` (línea 13 actual).
- **FR-002**: El sistema NO DEBE modificar ninguna otra entrada de `PUBLIC_ROUTES`, `USER_FINAL_ROUTES`, `COLEGIO_ROUTES`, `PAGOS_CLIENTE_ROUTES`, `COMITE_CONVIVENCIA_ROUTES`, `SESION_ROUTES`, `PUBLICAS_LECTURA_SCHOOL_ADMIN`, `APIS_LECTURA_SCHOOL_ADMIN`, `RUTAS_PERFIL` ni `ADMIN_ONLY_ROUTES`.
- **FR-003**: El sistema DEBE conservar la línea `"/api/consulta",` en `PUBLIC_ROUTES:25` (API en uso por el formulario del home).
- **FR-004**: El sistema DEBE conservar la línea `"/api/consulta"` en `APIS_LECTURA_SCHOOL_ADMIN` (proxy.ts:88).
- **FR-005**: El sistema DEBE agregar en `src/lib/proxy.test.ts` un test de regresión que verifique: sin token, `GET /consulta` produce respuesta con `status 307` y `Location` cuyo `pathname` es `/login`.
- **FR-006**: El sistema NO DEBE agregar tests que dependan de BD, de fixtures externos, ni tocar `src/lib/ai/**`.
- **FR-007**: El comentario existente en `proxy.ts:77-78` DEBE conservarse (documenta la razón y sigue siendo cierto).

### Key Entities

- **`PUBLIC_ROUTES`** (constante en `src/lib/proxy.ts`): lista de rutas que el proxy deja pasar sin exigir token. Después del fix, `/consulta` deja de estar en la lista; `/api/consulta` permanece.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `grep -n "\"/consulta\"" src/lib/proxy.ts` no lista `PUBLIC_ROUTES:13` (la entrada de página desapareció); el comentario `proxy.ts:77-78` puede seguir mencionando el string.
- **SC-002**: Test unitario nuevo pasa en verde: `sin sesión → GET /consulta` retorna `status === 307` y `location.pathname === "/login"`. (**Nota:** el INSTRUCTIVO §Criterios menciona `404`; el comportamiento real del proxy es `307 → /login`, análogo al catch-all que aplica a `/dashboard` en `proxy.test.ts:202-206`. Ver §Hallazgo previo.)
- **SC-003**: Los tests `LandingHero.test.tsx:90-94` y `url-privacy.test.ts:48` siguen pasando en verde (no se tocan; refuerzan el fix).
- **SC-004**: Los tests de la API `/api/consulta*` (`route.test.ts`, `route-f3.test.ts`, `detalle/route.test.ts`, `evento/route.test.ts`) siguen pasando en verde.
- **SC-005**: Gate LOCAL verde: `tsc --noEmit`, `lint 0 err`, `tokens:check`, `arch:check`, `locks:check`, `test:unit`.
- **SC-006**: Post-deploy en producción, `curl -s -o /dev/null -w "%{http_code}" https://pi.innovadataco.com/consulta` (sin cookies) devuelve `307` (redirect a login). Con `-L` termina en `200` sobre `/login`. **No** devuelve `404`; ese status era el que producía la ruta declarada-pero-inexistente antes del fix, y era justamente el síntoma que abrió I-136.

---

## Assumptions

- El worktree parte de `origin/feature/001-scaffolding` HEAD (`7d856c3b` al momento de la creación).
- La API `/api/consulta*` está viva y no debe modificarse en este frente.
- El comportamiento correcto del proxy para rutas privadas alcanzadas sin sesión es `redirectToLogin` (307), no `NotFound` (404). El INSTRUCTIVO menciona 404 por lectura del síntoma pre-fix; la SPEC deja explícito el cambio de contrato.
- Los guards `LandingHero.test.tsx` y `url-privacy.test.ts` son parte del muro que ya cierra la superficie desde otros ángulos; este frente los complementa desde el proxy.
- CERO cambios en `src/lib/ai/**`, cero migraciones, alcance mínimo (1 archivo modificado + 1 test agregado).
