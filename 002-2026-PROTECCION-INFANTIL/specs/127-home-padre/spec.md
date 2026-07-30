# Feature Specification: SPEC-127 — Home del padre (PARENT → /dashboard)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-043 (radica ZEUS). Cierra **I-40**, decisión vinculante **D-42**
(decidida por el CEO el 2026-07-29): `homeForRole` (`src/lib/proxy.ts:169-173`) no tiene caso
PARENT → cae al default `/dashboard/admin`, ruta que `esDestinoPermitidoPorRol(PARENT, …)`
niega (`proxy.ts:122`) → doble rebote en el rol principal del producto. Fix: caso explícito
PARENT → `/dashboard`. NADA MÁS. Excepción acotada al candado: `proxy.ts` se toca SOLO en
`homeForRole` (archivo peligroso, D-36).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El padre redirigido a su home aterriza en su área, sin rebotes (Priority: P1)

Como usuario con rol PARENT autenticado, cuando la puerta me redirige a mi home (por ejemplo,
al intentar entrar a una ruta admin-only o al área interna), quiero aterrizar en `/dashboard`
(mi área de usuario final), de modo que no rebote dos veces ni termine en una ruta que me
está negada.

**Why this priority**: PARENT es el rol principal del producto (el usuario final para el que
existe la plataforma). Hoy `redirectToHome(PARENT)` lo envía a `/dashboard/admin`, que la
propia puerta le niega y lo rebota a `/`: la redirección está rota exactamente para el rol
que más importa. No es fuga de seguridad (la puerta niega bien); es UX/redirección rota.

**Independent Test**: Test de regresión que ejecuta `proxy()` con una sesión PARENT contra
una ruta admin-only y verifica que el redirect apunta a `/dashboard`, y que `/dashboard` es
permitido para PARENT (sin segundo rebote). Corre aislado, sin tocar BD.

**Acceptance Scenarios**:

1. **Given** un PARENT autenticado, **When** la puerta ejecuta `redirectToHome` para él
   (ruta admin-only o área interna), **Then** el `Location` de la respuesta es `/dashboard`.
2. **Given** un PARENT autenticado, **When** accede a `/dashboard`, **Then** la puerta
   permite el paso (`NextResponse.next()`, sin redirect): aterriza sin rebote.
3. **Given** `homeForRole`, **When** se evalúa para cada rol, **Then** COMITE_VALIDACION →
   `/dashboard/admin/comite`, SCHOOL_ADMIN → `/dashboard/colegio`, PARENT → `/dashboard` y
   ADMIN/OPERADOR (default interno) → `/dashboard/admin` — los demás roles NO cambian.

---

### Edge Cases

- ADMIN y OPERADOR siguen cayendo al default `/dashboard/admin` (son roles internos y la
  ruta les está permitida): el default NO se toca.
- Token ausente/inválido/expirado sigue yendo a `/login` o 401: ese flujo queda intacto.
- `/dashboard` es ruta de usuario final: los roles internos que la visiten siguen siendo
  redirigidos a SU home (comportamiento existente, intacto).
- SCHOOL_ADMIN nunca pasa por `homeForRole` sin su caso propio: su rama del proxy lo
  resuelve antes; su home sigue siendo `/dashboard/colegio`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `homeForRole("PARENT")` DEBE devolver `"/dashboard"`.
- **FR-002**: `homeForRole` DEBE conservar intactos los destinos de COMITE_VALIDACION
  (`/dashboard/admin/comite`), SCHOOL_ADMIN (`/dashboard/colegio`) y el default interno
  (`/dashboard/admin`).
- **FR-003**: La modificación de `src/lib/proxy.ts` DEBE limitarse a `homeForRole`
  (líneas 169-173): ninguna otra función, constante o lista del archivo se toca.
- **FR-004**: DEBE existir un test de regresión del camino PARENT (D-36/D-42): redirigido
  a su home, el `Location` es `/dashboard` Y ese destino es permitido para PARENT por la
  propia puerta (aterriza sin doble rebote).
- **FR-005**: Tras el cambio, `docs/architecture/03-pantallas.md` (tabla home-por-rol y
  grafo de transiciones) DEBE regenerarse con los generadores de `scripts/arch/` y
  `npm run arch:check` DEBE quedar VERDE (la compuerta CI lo exige).
- **FR-006**: Con `proxy.ts` tocado (archivo peligroso, D-36) DEBEN quedar verdes: suite
  completa (`npm run test`), `npx tsc --noEmit` y `npm run build`.

### Key Entities *(include if feature involves data)*

- **Home por rol**: mapeo rol → ruta de aterrizaje que usa `redirectToHome`. Vive en
  `homeForRole` (código) y se documenta en `03-pantallas.md` (generado). Sin cambios de
  datos ni de schema.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El test de regresión del camino PARENT está verde y demuestra: redirect →
  `Location: /dashboard` → aterrizaje permitido, en una sola cadena sin segundo rebote.
- **SC-002**: Suite completa + `tsc --noEmit` + `build` verdes con `proxy.ts` modificado
  (exigencia D-36 para archivos peligrosos).
- **SC-003**: `arch:check` VERDE con `03-pantallas.md` regenerado: la tabla home-por-rol
  muestra PARENT → `/dashboard`.
- **SC-004**: Aserción A (puerta ≡ predicado) y Aserción B (menú que no miente) VERDES,
  sin allowlist ni excepciones nuevas.

## Assumptions

- `/dashboard` es la página de inicio del padre y ya existe (la línea base generada la
  muestra alcanzable solo por PARENT).
- Ningún flujo legítimo depende del comportamiento actual (PARENT rebotando a `/`): está
  verificado en fuente como defecto (I-40, verificada por ZEUS).
- El cambio no altera lo que la puerta permite o niega: solo el DESTINO de una redirección
  que ya ocurría. La Aserción A no debería moverse; si se moviera, se reporta y se para.

## Impacto en arquitectura

Impacto en arquitectura: TOCA `src/lib/proxy.ts` SOLO en `homeForRole` (excepción acotada
al candado, D-42) y REGENERA `docs/architecture/03-pantallas.md` (home-por-rol + grafo de
transiciones) con los generadores de `scripts/arch/`. No toca schema, navegación ni stack;
`02-roles-capacidades.md` no cambia (los veredictos de la puerta no se alteran).

## Implementación (cierre)

Implementada el 2026-07-29 en `feature/001-scaffolding` (instructivo 002-PI-043, compuerta
abierta por ZEUS). Pendiente de auditoría de ZEUS para el cierre formal. Puntos clave:

- **Fix (TDD)**: test de regresión creado primero en ROJO en `src/lib/proxy.test.ts`
  (PARENT → `/dashboard/admin`, el defecto exacto de I-40); tras añadir el caso
  `PARENT → /dashboard` en `homeForRole` (`src/lib/proxy.ts`, SOLO esa función, candado
  D-42 cumplido: diff de 3 líneas), la cadena cierra: redirect → `Location: /dashboard` →
  aterrizaje permitido (200), sin doble rebote. Tabla home-por-rol completa como guarda
  del default interno (ADMIN/OPERADOR intactos).
- **Línea base**: `docs/architecture/03-pantallas.md` regenerado (home-por-rol gana la
  fila PARENT; los redirects admin-only de PARENT ahora muestran `/dashboard`);
  `02-roles-capacidades.md` regenerado por la misma causa (destino del redirect de PARENT
  en rutas admin-only). `arch:check` VERDE: aserción A (1110 combinaciones) y aserción B
  (86 hrefs) verdes, sin allowlist ni excepciones nuevas.
- **Gate D-36**: suite completa, `tsc --noEmit` y build verdes (evidencia en el reporte
  de la cola 002-PI-043).
- **Deuda técnica**: ninguna nueva.
