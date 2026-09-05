# SPEC-426 · PROFESIONAL en lista blanca del proxy — candado bidireccional

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: veredicto CEO 23:0x sobre el barrido arch:check regenerado por #332 (SPEC-424).

## Para qué

Cerrar el hueco que el barrido regenerado por SPEC-424 destapó en `#332`: el proxy tenía a PROFESIONAL como si fuese PARENT — lista negra (`/api/admin`, `/dashboard/admin`) y todo lo demás abierto (~290 rutas permitidas, entre ellas las 84 de `/api/colegio/**`, las 30 de `/api/padre/**`, `/api/config/parametros/**`, `/api/interno/expediente/[id]/transicionar` y `/api/reportes/procesar`).

Cada handler de `/api/profesional/**` sí valida el rol, pero cualquier `/api/padre/**` que un día olvide su `verifyAuth("PARENT")` queda expuesto al PROFESIONAL sin que nadie lo note. La lista blanca lo cierra desde la puerta, con el mismo molde que SPEC-319 aplicó a COMITE_CONVIVENCIA / SCHOOL_ADMIN (defensa en profundidad).

## Diseño (CEO 23:0x)

Molde SPEC-319 · Comité de Convivencia:
- `PROFESIONAL_ROUTES` = superficie propia del rol.
- `esRutaPermitidaProfesional(pathname)` = superficie propia ∪ sesión ∪ perfil compartido ∪ árbol público de solo lectura (SPEC-118 D-37).
- Branch nuevo en `proxyCore`: si el rol es PROFESIONAL y la ruta no está permitida → 403 (API) o redirect al panel (página).
- Branch nuevo en `esDestinoPermitidoPorRol`: usa la misma función; menú, guards y arch:check quedan alineados sin código paralelo.
- **Candado bidireccional** en test: lo listado pasa, todo lo demás cae.

Superficie whitelisted:
- Páginas: `/dashboard/profesional`, `/perfil-profesional/**`.
- APIs: `/api/profesional/**` (panel · perfil · autorizacion · solicitudes · verificacion · franjas).
- Sesión + perfil (I-25, C-9, SPEC-203): `/api/me`, `/cambiar-password`, `/api/auth/cambiar-password`, `/api/auth/logout`, `/consentimiento` (+ API), `/dashboard/perfil`, `/api/notificaciones`.
- Árbol público de solo lectura (SPEC-118 · D-37): `/`, `/dashboard-publico`, `/seguimiento`, `/api/consulta`, `/api/estadisticas-publicas`, `/api/reportes/seguimiento`.

Superficie que ahora corta el proxy:
- Todo `/api/padre/**`, `/api/colegio/**`, `/api/interno/**`, `/api/config/parametros/**`, `/api/reportes` (POST/procesar), `/dashboard/padre`, `/dashboard/colegio`, `/dashboard/admin`, `/mis-reportes`, `/reportar` (una cuenta institucional no reporta, misma regla que otros roles internos).

## Qué trae

- **`src/lib/proxy.ts`**:
  - Nuevo `PROFESIONAL_ROUTES` (dashboard + `/perfil-profesional` + `/api/profesional`).
  - Nuevo `isProfesionalRoute` + `esRutaPermitidaProfesional` (misma forma que las otras).
  - Nuevo branch en `proxyCore` después de COMITE_CONVIVENCIA — 403 (API) / redirect (página).
  - Nueva línea en `esDestinoPermitidoPorRol` — `if (rol === "PROFESIONAL") return esRutaPermitidaProfesional(pathname);`.

- **`src/lib/proxy.test.ts`** — bloque `SPEC-426 · PROFESIONAL con lista blanca` con:
  - Predicado: 3 grupos «lo listado pasa» (superficie propia · sesión/perfil · árbol público D-37).
  - Predicado: 4 grupos «todo lo demás cae» (padre · colegio · interno + parámetros + reportes/procesar · /reportar y creación de reportes).
  - Proxy runtime: 6 casos (`/api/padre/citas` 403 · `/api/colegio/rector` 403 · `/api/reportes/procesar` 403 · `/dashboard/padre` → redirect al panel · panel aterriza 200 · `/api/profesional/panel` 200).
  - Cruzados: ADMIN sigue viendo `/api/admin/**` (lista negra intacta).

- **`docs/architecture/02-roles-capacidades.md`** regenerado — el barrido de la aserción C queda alineado sobre el nuevo `esDestinoPermitidoPorRol` de PROFESIONAL.

## Candados

- **Cada handler `/api/profesional/**` sigue validando `verifyAuth("PROFESIONAL")` o `user.rol !== "PROFESIONAL"`.** Esta lista blanca es defensa en profundidad, no la reemplaza.
- **`esDestinoPermitidoPorRol` es el criterio único** que consumen el menú (SPEC-113) y el barrido arch:check — el header no ofrece lo que el proxy no deja pasar.
- **Superficie mínima**: sólo lo que hoy usa el rol; agregar una ruta requiere pasar por acá (y por el test bidireccional, que la cierra por default).
- **Home consistente**: `/dashboard/profesional` (SPEC-425) — usado por el redirect cuando el proxy corta.

## Verificación

- `tsc --noEmit`: verde.
- `arch:check`: **VERDE** en los 7 gates tras regenerar `02-roles-capacidades.md`.
- `proxy.test.ts` — **49/49** (49 previos + los del bloque SPEC-426). Cierra ambos lados del candado.

## Impacto en arquitectura:

- Cierra la asimetría PARENT ≡ PROFESIONAL que el proxy tenía por defecto — pasa de lista negra ancha a lista blanca por rol (mismo molde que SCHOOL_ADMIN y COMITE_CONVIVENCIA).
- Consolida el patrón «un rol institucional nuevo entra por lista blanca» — reduce el riesgo de nuevos huecos I-289/I-290/I-297 cuando aparezca el próximo rol (VERIFICADOR ya lo hace por interno, la superficie del PROFESIONAL era la única fuera del molde).
- El barrido arch:check queda alineado — el guard, el menú y el predicado dicen lo mismo.

## Fuera de alcance

- Migrar VERIFICADOR a lista blanca — hoy vive dentro de `INTERNAL_ROLES` con cobertura por módulo, no aporta lo mismo.
- Cerrar candados equivalentes en `esRolInterno` (esa lista es aparte y ya está discutida en SPEC-408).
- Cambiar `/dashboard-publico` / `/api/estadisticas-publicas` — se abren para el PROFESIONAL con la misma regla D-37 que rige a SCHOOL_ADMIN.
- E2E Playwright de un PROFESIONAL intentando `/api/padre/citas` — el candado bidireccional de `proxy.test.ts` cubre el ratchet.

## I-312 (Jelkin vivo 04-09) · PARENT en área ajena vuelve a lo suyo (nunca a un error)

Cierra en el mismo PR una asimetría hermana que SPEC-426 dejó viva: PARENT no tenía guard en `/dashboard/profesional/**` ni en `/dashboard/colegio/**` — el catch-all lo dejaba pasar y el `verifyAuth("PROFESIONAL"/"SCHOOL_ADMIN")` del layout lanzaba 403 en pantalla. Lección I-299: cada rol vuelve a su área, nunca a un error.

### Cambios

- **`src/lib/proxy.ts`** — `esDestinoPermitidoPorRol` retorna `false` para PARENT en áreas de otros roles (`isProfesionalRoute`, `isColegioRoute`, `isComiteConvivenciaRoute`), no solo para admin. Y en `proxyCore`, branch nuevo para PARENT: 307 a `/dashboard/padre` (páginas), 403 JSON (APIs).
- **`src/components/modules/NavHeader.tsx`** — `destinoLogo` para PROFESIONAL va a `/dashboard/profesional` (antes caía al default `/dashboard` que el proxy le niega — href muerto que la aserción B de `arch:check` cazó tras regenerar).
- **`scripts/arch/lib/nav-fuentes.ts`** — `hrefsLogoPorRol("PROFESIONAL")` alineado con el JSX del header.

### Candado bidireccional (proxy.test.ts)

Nuevo bloque `SPEC-426 · I-312 · PARENT redirect en áreas ajenas (nunca error)`:
- Predicado (5 tests): PARENT NO en `/dashboard/profesional`, `/api/profesional/**`, `/dashboard/colegio`, `/api/colegio/**`, `/dashboard/colegio/comite`. Contraprueba: sigue viendo `/dashboard/padre`, `/mis-reportes`, `/api/padre/**`, `/reportar`, `/api/notificaciones`. PROFESIONAL sigue en lo suyo.
- Runtime (6 tests): PARENT en `/dashboard/profesional` → 307 a `/dashboard/padre`; en `/dashboard/profesional/agenda` → 307; en `/api/profesional/panel` → 403 JSON; en `/dashboard/colegio` → 307. Contraprueba: PARENT en `/dashboard/padre` → 200 (no rebota). Simetría: PROFESIONAL en `/dashboard/padre` → 307 a su panel (SPEC-426 sigue vivo).

**Verificado por mutación**: comentar el branch PARENT nuevo en `proxyCore` mata 4 tests.

## Referencias

- **I-312** (Jelkin vivo 04-09) — un padre aterriza en `/dashboard/profesional/**` y recibe 403 en pantalla en vez de volver a su área.
- **SPEC-424 (#332)** — regeneró el barrido y expuso el hueco.
- **SPEC-425 (#330)** — panel del profesional, home del redirect.
- **SPEC-319** — molde de la lista blanca (COMITE_CONVIVENCIA).
- **SPEC-113** — `esDestinoPermitidoPorRol` como criterio único menú/guard.
- **SPEC-118 / D-37** — árbol público de solo lectura que también ve el rector.
- **I-299** — cada rol vuelve a su área, nunca a un error (patrón compartido).
- Worktree `.worktrees/pi-SPEC-426` desde `origin/main cef697d5c`.
