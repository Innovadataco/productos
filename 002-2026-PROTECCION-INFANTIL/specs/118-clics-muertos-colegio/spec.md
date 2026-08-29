# Feature Specification: Clics muertos del colegio (D-37)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Status**: IMPLEMENTADO (SIN desplegar — commit sin push; el coordinador de la cola 002-PI-041 empuja y despliega)

## Contexto

Cola nocturna 002-PI-041, bloque B4. Dos clics muertos para el `SCHOOL_ADMIN`,
con causas distintas:

a) **El logo del header**: SPEC-114 (I-38) hizo que, si el destino es la página
   actual, el logo apunte a `/`. Pero el proxy aísla al `SCHOOL_ADMIN` a las rutas
   de su módulo y `/` no es una de ellas: va al inicio, el proxy lo rebota a
   `/dashboard/colegio` y visualmente no pasa nada (clic muerto por rebote).
b) **El botón "Dashboard"**: para un colegio apunta a `/dashboard/colegio` —donde
   ya está—. Clic muerto puro (destino = página actual).

**Decisión de arquitectura de ZEUS (cerrada)**: se abren al colegio las rutas
públicas de **solo lectura** — inicio (`/`), dashboard público (`/dashboard-publico`),
consulta (`/consulta`) y seguimiento (`/seguimiento`) — con las APIs públicas de
solo lectura que esas pantallas consumen. Se mantiene bloqueado: el área de admin
(`/dashboard/admin`, `/api/admin`), el área de padres (`/dashboard`, `/mis-reportes`)
y `/reportar` (una cuenta institucional no reporta). El aislamiento total no
aportaba seguridad (el dashboard público es información pública, alcanzable incluso
sin sesión): aportaba clics muertos.

**Regla generalizada (D-37)**: *ningún elemento de navegación ofrece un destino que
el proxy vaya a bloquear o que sea la página actual*. Aplica al logo Y al botón
Dashboard (y al resto de enlaces del header) para TODOS los roles, no solo colegio.

**Guardas**: IMPLEMENTAR y commitear en `feature/001-scaffolding`, **SIN push y SIN
DESPLEGAR** (el coordinador empuja en serie y gatea el deploy).

## User Stories

### US-1 (P1) — El colegio navega el área pública de solo lectura

Como administrador de un colegio quiero poder abrir el inicio, el dashboard
público y la pantalla de seguimiento sin que el proxy me rebote a mi panel, para
conocer la misma información pública agregada que ve cualquier ciudadano.

**Escenarios de aceptación**:

1. `SCHOOL_ADMIN` autenticado navega a `/` → el proxy deja pasar (sin redirect).
2. `SCHOOL_ADMIN` navega a `/dashboard-publico` y `/seguimiento` → pasa.
3. Las APIs públicas de solo lectura que consumen esas pantallas (`/api/consulta`,
   `/api/estadisticas-publicas`, `/api/reportes/seguimiento/[numero]`) responden al
   colegio (el proxy no devuelve 403).
4. `SCHOOL_ADMIN` sigue SIN poder entrar a `/dashboard/admin`, `/api/admin/*`,
   `/dashboard`, `/mis-reportes` ni `/reportar` (403/redirect, como antes).

### US-2 (P1) — Ningún enlace del header es clic muerto (D-37, todos los roles)

Como usuario de cualquier rol quiero que el header nunca me ofrezca un enlace a la
página en la que ya estoy ni a un destino que el proxy bloquea, para que cada clic
tenga efecto visible.

**Escenarios de aceptación**:

1. `SCHOOL_ADMIN` en `/dashboard/colegio`: el botón "Dashboard" no se ofrece (su
   destino es la página actual) y el logo apunta a `/` (destino vivo tras US-1).
2. `PARENT` en `/dashboard`: el botón "Dashboard" no se ofrece.
3. Anónimo (o cualquier rol) en `/dashboard-publico`: el botón "Dashboard" (que
   apunta a `/dashboard-publico`) no se ofrece.
4. Por propiedad: en el header renderizado en el home de cada uno de los 5 roles,
   ningún enlace visible apunta al pathname actual.
5. El logo siempre se renderiza (es la marca); la excepción deliberada es `/`
   estando en `/` (convención universal, sin destino alternativo razonable).

## Requisitos funcionales

- **FR-1**: `esRutaPermitidaSchoolAdmin` (`src/lib/proxy.ts`) permite además las
  rutas públicas de solo lectura `/`, `/dashboard-publico`, `/seguimiento` y las
  APIs `/api/consulta`, `/api/estadisticas-publicas`, `/api/reportes/seguimiento`.
  Inventario por pantalla (para no abrir de más):
  - home `/`: su formulario de consulta llama `POST /api/consulta` (consulta de
    estadísticas agregadas; el POST solo evita exponer el identificador en la URL).
  - `/dashboard-publico`: `GET /api/estadisticas-publicas`.
  - `/seguimiento`: `GET /api/reportes/seguimiento/[numero]`.
  - `/consulta` **no existe como página** (la consulta pública vive en el home);
    su superficie real es la API `/api/consulta` (GET/POST, solo lectura). No hay
    ruta de página que abrir.
  - **NO** se abre `/api/reportes` completo: su `POST` crea reportes y la cuenta
    institucional no reporta. Solo el sub-árbol `/api/reportes/seguimiento` (GET).
- **FR-2**: se mantiene bloqueado para `SCHOOL_ADMIN`: `/dashboard/admin`,
  `/api/admin/*`, `/dashboard`, `/mis-reportes`, `/reportar`, `/api/reportes`
  (POST de creación) y cualquier otra ruta no listada en FR-1.
- **FR-3**: `NavHeader` aplica D-37 con una única regla para todos los roles:
  un enlace de navegación solo se ofrece si (a) el rol puede usarlo según
  `esDestinoPermitidoPorRol` (misma fuente de verdad del proxy, SPEC-113) y
  (b) su destino no es la página actual. Aplica al botón "Dashboard" (desktop y
  móvil), a los enlaces del menú de usuario y a los del menú móvil.
- **FR-4**: el logo conserva la regla SPEC-114 (nunca apunta al pathname actual
  dentro del área autenticada; si coinciden, va a `/`) y, gracias a FR-1, `/` es
  destino vivo para el colegio. Excepción deliberada: en `/` el logo apunta a `/`.

## Success Criteria

- **SC-001**: tests del proxy verdes: permite `/`, `/dashboard-publico`,
  `/seguimiento`, `/api/consulta`, `/api/estadisticas-publicas` y
  `/api/reportes/seguimiento/X` al `SCHOOL_ADMIN`; sigue bloqueando
  `/dashboard/admin`, `/api/admin/*`, `/dashboard`, `/mis-reportes`, `/reportar`.
- **SC-002**: tests del header verdes: el botón "Dashboard" no se ofrece cuando su
  destino es la página actual (colegio, padre, anónimo); ningún enlace visible del
  header apunta al pathname actual en el home de los 5 roles.
- **SC-003**: journeys e2e (`src/lib/e2e`) verdes con la matriz de aislamiento
  actualizada (justificación D-37, no ablandamiento).
- **SC-004**: gate verde (tsc + lint + tests + build), commits selectivos, SIN
  push y SIN desplegar.

## Assumptions

- Todo destino público es alcanzable incluso sin sesión; abrirlo al colegio no
  revela nada que el propio colegio no pueda ver cerrando sesión. La seguridad del
  aislamiento la dan las rutas que SIGUEN cerradas (FR-2), no las públicas.
- El menú usa la MISMA fuente de verdad del proxy (`esDestinoPermitidoPorRol`,
  SPEC-113/I-36): al abrir las rutas en el proxy, el criterio del menú queda
  consistente sin una segunda lista.
