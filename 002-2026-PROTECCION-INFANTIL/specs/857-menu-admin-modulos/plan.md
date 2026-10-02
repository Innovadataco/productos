# Plan · SPEC-857

## Enfoque

Cambio de FORMA, UI-only, sobre la fuente única de navegación (SPEC-744). No toca schema, endpoints ni proxy. Se construye por piezas, manteniendo verdes los candados nav y `arch:check` en el mismo PR.

## Orden de construcción (una pieza, un commit lógico)

1. **Dato** (`nav-items.ts`): `NavItem.modulo` opcional + `encabezado?`; helper `aplanarNavItems`; reescritura de `ADMIN_NAV_ITEMS` al árbol de 2 niveles (9 módulos, 2 encabezados, hojas sueltas); `PRINCIPALES_MOVIL.ADMIN` repunta `/estadisticas` → `/estadisticas/operacion`.
2. **Resolver** (`nav/para-rol.ts`): compuerta de grupo por HIJOS (no por el módulo del grupo); paso de encabezados con supresión de huérfanos; `aplanar`/`navMovilParaRol` omiten encabezados; default móvil dedupe por ícono.
3. **Barra lateral** (`NavLateral.tsx`): `EncabezadoLateral` no clicable; colapso por familia (admin colapsado + abrir-en-activo; colegio/padre expandidos); ámbar de Pagos en grupo + hijos; activo por prefijo-más-largo.
4. **Íconos** (`IconoNav.tsx`): 8 claves semánticas de grupo (reusan componentes existentes); retiro de las entradas de ex-raíces/hijos y de los 5 componentes que quedan sin uso.
5. **Consumidores de la fuente**: `admin/page.tsx` (redirect a hoja real); `arraysNav` (aplana ADMIN); `ComiteSubNav` (guarda de módulo opcional).
6. **Candados**: actualizar al árbol de 2 niveles (Comité subruta, Pagos ámbar, headers fuera de hojas/íconos, default móvil dedupe, SIN_PANTALLA_PROPIA −3).

## Gate

`tsc --noEmit` · `lint` · `test:unit` (job completo) · candados nav de integración · `build` · `arch:check` · recorrido en vivo (Diseño certifica contra ec4910a).

## Riesgos y mitigación

- **Blast radius del candado `nav-superficie-unica`** (DESTINOS_NAV crece con las hojas promovidas): verificado VERDE — ningún `<nav>` quema esos hrefs.
- **Colisión de íconos en la barra móvil de roles internos** (hojas hermanas comparten ícono de grupo): resuelto con dedupe por ícono en el default.
- **Activo por prefijo** con hojas anidadas (`/comite` prefijo de `/comite/gestion`): resuelto con prefijo-más-largo (un solo ganador).
