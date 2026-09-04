# SPEC-424 · El profesional aterriza donde le corresponde y no ve el menú del padre — cierra I-299

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: I-299 · Jelkin encontró el bug entrando a producción tras SPEC-421. **Alcance final aprobado por CEO 22:2x** = puntos 1-3 (aterrizaje + menú). El punto 4 (hardening del proxy) va en **SPEC-426**.

## Para qué

**El defecto (I-299)**: `src/lib/auth/home-para-rol.ts` no tenía `case "PROFESIONAL"`, así que el rol caía al default `/mis-reportes` — la pantalla del padre. Y `NavHeader.tsx` marcaba `esEmpleado` solo para ADMIN/OPERADOR/COMITE_*/COMITE_CONVIVENCIA, así que el PROFESIONAL entraba al bloque `!esEmpleado` y **heredaba los items del padre**: "Mi panel", "Círculo de Confianza", "Mis reportes". Jelkin vio en pantalla: menú con opciones de padre + reportes fallando con «No pudimos cargar tus reportes».

**Auditoría de riesgo hecha antes de codear** (CEO 22:15 pidió reporte previo por SPEC-426):
- Barrido de los 30 endpoints `/api/padre/**`: 17 con `verifyAuth("PARENT")` (cortan al PROFESIONAL con 403), 6 públicos por diseño (directorio de psicólogos), 4 con guard inline `if (user.rol !== "PARENT")`, 3 auto-scopeados por `user.id` (el PROFESIONAL vería solo lo SUYO, vacío).
- **Sin fuga de datos cross-user**. El defecto era UX + landing rota. Riesgo bajo.
- El hardening del proxy `esDestinoPermitidoPorRol` (para reducir la superficie) queda para SPEC-426, aislado: un despliegue, un sospechoso.

## Qué trae

### 1) Landing por rol

- **`src/lib/auth/home-para-rol.ts`** — nuevo `case "PROFESIONAL": return "/perfil-profesional/verificacion"`. Es la única pantalla que hoy tiene su propia interfaz.
- **Nota anclada** en el comentario: cuando SPEC-425 (Dev 02 · panel L5) mergee, esa **una** línea se cambia a `/dashboard/profesional`. No hay más callsites que actualizar.

### 2) Lista de navegación propia

- **`src/lib/nav-items.ts`** — nueva `PROFESIONAL_NAV_ITEMS` con dos entradas: `Verificación` (`/perfil-profesional/verificacion`) y `Mi ficha` (`/perfil-profesional/completar`). Estructura `PadreNavItem` (sin `modulo` — el profesional no tiene sistema de módulos como el admin).
- **NO hereda** de `PADRE_NAV_ITEMS`. Comentario anclado que dice qué agregar cuando SPEC-425 entregue el panel.

### 3) NavHeader

- **`src/components/modules/NavHeader.tsx`** ·
  - `esEmpleado` ahora incluye `VERIFICADOR` y `PROFESIONAL` (renombre semántico documentado en el comentario: "no debería ver items del padre"). Sin esto, el `!esEmpleado` seguía inyectando "Mi panel"/"Círculo"/"Mis reportes" al PROFESIONAL.
  - `dashboardHref` case `PROFESIONAL` → `/perfil-profesional/verificacion`. Sin esto el botón "Dashboard" del profesional caía al genérico anónimo.
  - Dropdown de usuario · bloque nuevo `user.rol === "PROFESIONAL"` con "Verificación" y "Mi ficha".
  - Menú mobile · misma pareja.

### 4) Fuente única de arquitectura

- **`scripts/arch/lib/nav-fuentes.ts`** · declaradas las guardas de rol de los dos hrefs nuevos en `GUARDAS_HEADER` — sin esto `parsearHeader` fallaba (regla condición ZEUS 2: literal sin guarda es fallo ruidoso).
- `docs/architecture/02-roles-capacidades.md` regenerado sin drift.

## Candados

- **Un rol, una landing** — el switch en `home-para-rol.ts` es la fuente única (SPEC-319).
- **`esEmpleado` (nombre stale, semántica clara)** — cualquier rol que no sea PARENT queda por defecto fuera de los items del padre; se documenta en el comentario.
- **La línea del landing es fácil de mover** (encargo CEO 22:2x) — solo `home-para-rol.ts` cambia cuando llegue el panel.
- **Guardas del header declaradas en `GUARDAS_HEADER`** — regla ya existente, cualquier href nuevo del header sin guarda declarada rompe el arch:check.
- **No se toca `esDestinoPermitidoPorRol`** — el hardening (allowlist estricta para PROFESIONAL) es scope de SPEC-426. Este PR resuelve solo UX/landing.

## Verificación

- `npm run test:unit` → **2317/2317**. Pool routing 3/3 files con 25/25 tests que cubren nav-header/logo/items pasan.
- `tsc --noEmit` + `arch:check` (7 gates) + `tokens:check` (piso 1079) + `eslint` verdes (solo el warning pre-existente de complejidad de `NavHeader`).
- **Post-deploy (para Calidad)**:
  1. Login como PROFESIONAL → aterriza en `/perfil-profesional/verificacion` (antes: `/mis-reportes`, roto).
  2. El menú de usuario y el menú mobile solo muestran "Verificación" + "Mi ficha" + "Cambiar contraseña" + "Cerrar sesión" — sin "Mi panel", "Círculo de Confianza" ni "Mis reportes".
  3. El botón "Dashboard" del header lleva a `/perfil-profesional/verificacion`, no a `/dashboard-publico`.
  4. Ningún endpoint padre revela datos cross-user al PROFESIONAL (verificado en auditoría · queda cerrado por scope + guards existentes).

## Impacto en arquitectura:

Formaliza al PROFESIONAL como **rol externo con área propia**: como el padre (externo, no interno) pero con su propio landing y lista de navegación separada. El renombre semántico de `esEmpleado` a "no debería ver items del padre" queda documentado — cuando aparezca un nuevo rol externo que no sea PARENT, se agrega ahí.

El landing por rol sigue centralizado en `home-para-rol.ts` (SPEC-319): mover un rol de una pantalla a otra es UNA línea. La coordinación con Dev 02 (SPEC-425) queda anclada en comentarios de dos archivos (`home-para-rol.ts` + `nav-items.ts`) — cuando SPEC-425 mergee, el diff es pequeño y las notas apuntan exactamente a las líneas.

## Fuera de alcance

- **SPEC-426 (proxy hardening)** — `esDestinoPermitidoPorRol` acota al PROFESIONAL a una allowlist (perfil, sesión, cambiar-password, directorio público). Se separa por regla del CEO: I-211 nos enseñó que tocar guardianes junto con UX oculta la fuente del ruido.
- **SPEC-425 (panel L5 del profesional)** — lo construye Dev 02 (`idc-80`). Este PR deja el landing en `/perfil-profesional/verificacion`; cuando SPEC-425 mergee, se mueve a `/dashboard/profesional` en dos líneas (una en `home-para-rol.ts`, una en `PROFESIONAL_NAV_ITEMS`).
- **Dashboard/pantalla propia** del profesional: hasta que llegue SPEC-425, el profesional aterriza en su pantalla de verificación existente (SPEC-408).

## Referencias

- **I-299** · Jelkin en producción `f57eb703`.
- **SPEC-319** — fuente única `homeParaRol`.
- **SPEC-391** — pantalla `/perfil-profesional/completar` (existe).
- **SPEC-408** — pantalla `/perfil-profesional/verificacion` (existe).
- **SPEC-425** (futuro · Dev 02) — panel del profesional (L5).
- **SPEC-426** (futuro · yo) — hardening del proxy para PROFESIONAL.
- **I-211** — lección: guardianes muertos en silencio; nunca los mezcles con cambios cosméticos.
- Worktree `.worktrees/pi-SPEC-424` desde `origin/main f57eb7033`.
