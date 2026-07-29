# Implementation Plan: Spec 118 — Clics muertos del colegio (D-37)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

## Diseño

1. **Proxy (`src/lib/proxy.ts`)** — FR-1/FR-2:
   - Nueva lista `PUBLICAS_LECTURA_SCHOOL_ADMIN = ["/", "/dashboard-publico", "/seguimiento"]`.
   - Nueva lista `APIS_LECTURA_SCHOOL_ADMIN = ["/api/consulta", "/api/estadisticas-publicas", "/api/reportes/seguimiento"]`
     (inventario por pantalla en FR-1 del spec; `/consulta` no existe como página —
     su superficie real es la API, abierta; `/api/reportes` NO se abre completo
     porque su POST crea reportes).
   - `esRutaPermitidaSchoolAdmin` = colegio + sesión + esas dos listas, con un
     helper `matchesRoute` (`pathname === route || startsWith(route + "/")`) que
     trata `/` como coincidencia EXACTA (un `startsWith("//")` nunca casa: la
     raíz no puede abrir el árbol entero).
   - `esDestinoPermitidoPorRol` delega en `esRutaPermitidaSchoolAdmin` para
     `SCHOOL_ADMIN`: el criterio del menú (SPEC-113) queda actualizado solo.
   - `proxyCore` no cambia: su rama `SCHOOL_ADMIN` ya llama a
     `esRutaPermitidaSchoolAdmin`. Se actualizan los comentarios que describían
     el aislamiento total.
2. **Header (`src/components/modules/NavHeader.tsx`)** — FR-3/FR-4:
   - Helper `esEnlaceNavegable(rol, href, pathname)` =
     `href !== pathname && esDestinoPermitidoPorRol(rol, href)` — una sola regla
     (D-37) para todos los enlaces de navegación y todos los roles.
   - Botón "Dashboard" (desktop y móvil): solo se renderiza si es navegable
     (en la página destino se oculta; esto cierra el clic muerto del colegio y el
     del anónimo en `/dashboard-publico`).
   - Enlaces del menú de usuario y del menú móvil: mismo predicado (incluye
     "Cambiar contraseña" e "Iniciar sesión").
   - Logo: sin cambios de lógica (SPEC-114 ya evita el pathname actual dentro del
     área autenticada y manda a `/`, que FR-1 vuelve destino vivo para el
     colegio). Excepción documentada: en `/` el logo apunta a `/` (la marca no se
     oculta; convención universal).
3. **Tests primero (rojo → verde)**:
   - `src/lib/proxy.test.ts`: el caso `esRutaPermitidaSchoolAdmin("/")` pasa a
     `true` (decisión de producto NUEVA y explícita — D-37/ZEUS; NO es
     ablandamiento) + casos nuevos de rutas abiertas y de las que siguen cerradas.
   - `src/components/modules/NavHeader.test.tsx`: D-37 — "Dashboard" oculto en su
     propia página destino (colegio, padre, anónimo) y visible fuera de ella.
   - `src/lib/e2e/journeys/aislamiento.test.ts`: la matriz menú=proxy añade las
     rutas públicas de solo lectura como PERMITIDAS para `SCHOOL_ADMIN` (con
     comentario de justificación D-37) y mantiene los bloqueos.
   - `src/lib/e2e/journeys/sesion-roles.test.tsx`: por propiedad — en el home de
     cada rol, ningún enlace visible del header apunta al pathname actual; el
     colegio además alcanza `/` y `/dashboard-publico` por el proxy real.
4. **Gate bajo candado** (`/tmp/pi-gate-lock`): tsc + lint + tests tocados +
   `src/lib/e2e` entera + build; suite completa `npm run test` al final.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Abrir de más por prefijo (`/` casa todo) | `matchesRoute` con igualdad exacta para `/`; test dedicado (`/x` no permitida) |
| Abrir el POST de `/api/reportes` por prefijo | Solo se abre `/api/reportes/seguimiento`; test que `/api/reportes` sigue cerrada |
| Romper journeys de otros roles al tocar el header | Predicado único y suite `src/lib/e2e` entera en el gate |
| Otros agentes en paralelo pisan los mismos archivos | Staging selectivo con rutas explícitas; `git status` antes de cada commit |

## Despliegue

**DIFERIDO** (guarda de la cola 002-PI-041): implementar + commitear SIN push;
el coordinador empuja en serie y despliega con `./scripts/dev-restart.sh`.
