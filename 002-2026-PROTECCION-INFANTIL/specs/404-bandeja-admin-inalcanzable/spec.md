# SPEC-404 · Bandeja de reportes con URL propia — cierra I-290

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: brief CEO (`idc-59`) 03-09-2026 11:22 (Jelkin bloqueado en producción sin poder abrir la Bandeja).

## Para qué

**El bug (I-290)**: verificado en el hash de producción `d3057f3b`. El ítem del menú "Bandeja de reportes" en [`nav-items.ts:18`](../../src/lib/nav-items.ts:18) apuntaba a `/dashboard/admin`. El [`page.tsx`](../../src/app/dashboard/admin/page.tsx) de esa ruta (SPEC-378) redirige a `/dashboard/admin/inicio` cuando el admin tiene el módulo `inicio_admin`. Resultado: **cualquier admin con Inicio hace click en la bandeja y aterriza en Inicio — la bandeja es inalcanzable**. Jelkin está bloqueado ahora mismo.

**El bug estructural**: `arch:check (d)` (aserción B, "el menú no miente") dice "118 hrefs alcanzables" y no cazó esto. `esDestinoPermitidoPorRol("ADMIN", "/dashboard/admin")` sí devuelve true — la puerta pasa. Lo que la puerta no verifica es si el `page.tsx` del destino **muestra lo que promete** o silenciosamente redirige a otro item del menú. **Alcanzable ≠ funcional.**

## Qué trae

### 1) La bandeja tiene URL propia

- **`src/app/dashboard/admin/bandeja/page.tsx` (nuevo)** — gate por `bandeja_reportes` y renderiza `<AdminReportesTable rol=…/>`. Cero redirects propios: si el rol no tiene el módulo → `<SinAccesoModulo />`.
- **`src/app/dashboard/admin/page.tsx` (reescrito)** — queda como **aterrizaje** que respeta marcadores viejos:
  1. Si tiene `inicio_admin` → redirect a `/dashboard/admin/inicio` (SPEC-378 preservado).
  2. Si tiene `bandeja_reportes` → redirect a `/dashboard/admin/bandeja` (donde estaba la bandeja hasta ayer).
  3. Si tiene otro módulo → primer ítem del menú al que pueda entrar (mismo fallback que hoy).
  4. Sin módulos → `<SinModulosAsignados />`.

No es un item del menú: la raíz-aterrizaje solo existe para bookmarks viejos.

### 2) Cada "volver" apunta a la bandeja, no a la raíz

Los 5 sitios que decían `/dashboard/admin` como destino "volver a admin" ahora dicen `/dashboard/admin/bandeja`:

- [`src/components/modules/NavHeader.tsx:28`](../../src/components/modules/NavHeader.tsx:28) — `destinoLogo()` para ADMIN/OPERADOR.
- [`src/app/dashboard/admin/operadores/page.tsx:11`](../../src/app/dashboard/admin/operadores/page.tsx:11) — `homeAccesoDenegado()` fallback.
- [`src/app/dashboard/admin/identificador/[nick]/page.tsx:37`](../../src/app/dashboard/admin/identificador/[nick]/page.tsx:37) — redirect por rol no permitido.
- [`src/app/consentimiento/page.tsx:14-16`](../../src/app/consentimiento/page.tsx:14) — `DASHBOARD_POR_ROL` para ADMIN/OPERADOR/COMITE_VALIDACION.
- [`src/app/dashboard/circulo-confianza/page.tsx:39`](../../src/app/dashboard/circulo-confianza/page.tsx:39) — router.push tras la carga del rol.

En cada uno el "volver" ahora aterriza directo en trabajo real, no en la raíz-aterrizaje.

### 3) Candado en `arch:check` — la aserción que faltaba

**`scripts/arch/asercion-menu-no-redirige-a-otro-item.ts` (nuevo)** — para cada href de item del menú resuelve el `page.tsx` correspondiente y lo escanea buscando `redirect("…")` con literal que sea otro href del mismo menú. Falla ruidoso listando origen → destino.

- **`scripts/arch/arch-check.ts`** — agrega el paso `(d-bis)` junto a la aserción B existente. Un fallo lo pone rojo igual que `(d)`.
- **`scripts/arch/aserciones.test.ts`** — cubre la aserción como test local igual que A y B.
- Sin la aserción, cualquier fusión futura donde alguien meta un `redirect(otroItem)` en un page.tsx de item pasa CI y llega a producción como en I-290.

**Con el código anterior a este SPEC**, la aserción devuelve **ROJO listando `/dashboard/admin → /dashboard/admin/inicio`** — es decir, hubiera cazado I-290 en CI.

### 4) Tests unit actualizados

- [`AdminNav.test.tsx`](../../src/components/modules/AdminNav.test.tsx) — nuevo caso "la URL propia de la bandeja se resalta la bandeja" + "raíz-aterrizaje no resalta ningún item".
- [`NavHeader.test.tsx`](../../src/components/modules/NavHeader.test.tsx) — logo de ADMIN aterriza en `/dashboard/admin/bandeja`.
- [`nav-logo.test.ts`](../../src/components/modules/nav-logo.test.ts) — `destinoLogo(ADMIN)` en zona autenticada y en `/dashboard-publico` devuelve la bandeja.

## Candados

- **La aserción `(d-bis)` de `arch:check` cierra el hueco estructural**: cualquier item cuyo `page.tsx` redirija a otro item del mismo menú es ROJO en CI. Fue validada eliminando el fix local: cazó el defecto original tal cual.
- **`/dashboard/admin` sigue existiendo** como aterrizaje que respeta bookmarks — no rompemos historial de nadie.
- **Solo el ítem del menú y los 5 "volver" cambian de URL**. Nadie más del código depende de que la bandeja viva en la raíz.
- **`AdminNav` no requiere cambio de lógica**: el guard `link.href !== "/dashboard/admin"` existente sigue siendo defensivo, pero ya no es necesario porque la raíz salió del array.
- **La landing prioriza Inicio sobre Bandeja** — mismo orden que SPEC-378 dejó: si el admin tiene la alarma, es lo primero que ve.

## Verificación

**Local**:
- `npm run arch:check` → **6 verificaciones VERDES** (a, b, c, d, d-bis, e, f).
- `npm run test:unit` → **2111/2111**.
- `tsc --noEmit` verde.
- `eslint` limpio en los archivos tocados.
- **La aserción `(d-bis)` cazó el defecto original**: probada con `git stash` de `nav-items.ts` (bandeja apuntando a raíz) → ROJO listando `/dashboard/admin → /dashboard/admin/inicio`.

**En producción (post-deploy)**:
- ADMIN con `inicio_admin` hace login → aterriza en `/dashboard/admin/inicio` (SPEC-378 preservado).
- Ese mismo ADMIN hace click en "Bandeja de reportes" → aterriza en `/dashboard/admin/bandeja` con la tabla real, no en Inicio.
- Un ADMIN con marcador viejo a `/dashboard/admin` → redirect transparente al mismo destino que su login (Inicio si tiene el módulo, Bandeja si no).
- **Coordinación con SPEC-405 (Calidad)**: cuando su e2e mergee antes, hay que rebasar esta rama y quitar el `test.fail` del spec `tests/e2e/admin-menu-alcanzable-y-muestra.spec.ts` — con este fix los tests deben pasar de verdad.

## Impacto en arquitectura:

**Nueva regla dura del gate arch:** el `page.tsx` de un item de menú NO puede contener `redirect("…")` a otro item del mismo menú. La regla existente ("el menú no miente" = alcanzable según la puerta) se acompaña ahora de "y además el destino muestra lo que el href promete". Cualquier item futuro que dependa de un redirect condicional a otro item queda ROJO en `arch:check (d-bis)` — la solución correcta es darle URL propia al destino y usar la raíz de área como aterrizaje.

`/dashboard/admin` cambia de rol: era pantalla de trabajo (Bandeja) → pasa a ser **aterrizaje puro** (sin renderizar UI propia). Cualquier código nuevo que quiera montar UI en la raíz de un área debe crear ruta hija y dejar la raíz como aterrizaje.

## Fuera de alcance

- **SPEC-378 (Inicio del administrador)** — no se toca; sigue viviendo en `/dashboard/admin/inicio` con exactamente el mismo comportamiento.
- **SPEC-405 (Calidad)** — e2e candado del menú que Calidad va a mergear antes. Cuando entre, esta rama se rebasa y se quita el `test.fail` que Calidad deja marcado.
- **`/dashboard/colegio` raíz** — mismo patrón podría tener sentido allí, pero está fuera del brief y no hay evidencia de bug.
- **Consolidar la fuente única `homeForRole`** — cinco callsites siguen manteniendo su propio switch por rol. Refactor mayor, no urgente.

## Referencias

- **I-290** (Bandeja inalcanzable) · verificado en `d3057f3b` prod.
- **I-283 / I-289** — otras urgencias del día; no relacionadas con este SPEC.
- **SPEC-378** — Inicio del administrador (introdujo el `redirect` que expuso el defecto).
- **SPEC-126 · D-41** — aserciones A/B del `arch:check`; este PR agrega la B-bis.
- [`middleware.ts`](../../middleware.ts) — sin cambios; la puerta autoriza correctamente `/dashboard/admin/bandeja` con el módulo `bandeja_reportes`.
- **I-109 / D-82** — un Dev, un worktree. Este PR arranca desde `origin/main d832ec3db` en `.worktrees/pi-SPEC-404`.
