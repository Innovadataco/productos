# Arquitectura de navegación (SPEC-744)

> **Regla dura, antes que nada:** **NUNCA se escriben listas de navegación a mano** en un
> componente. Toda la nav sale de la **fuente única** (`navParaRol` / `navMovilParaRol`). Si
> tenés que enumerar destinos de rol dentro de una superficie, estás reintroduciendo el defecto
> que SPEC-744 vino a cerrar — y el candado de CI te lo va a rechazar.

## Por qué existe esto (el defecto)

Antes de SPEC-744 cada superficie armaba su propia lista de nav. `NavHeader` tenía la nav
**escrita a mano por rol** (el padre: «Mi panel / Círculo de Confianza / Mis reportes»),
desincronizada de `PADRE_NAV_ITEMS`. Dos fuentes → una se queda vieja → el menú miente. Jelkin
lo cazó en vivo. La cura no fue arreglar la lista: fue **borrar todas las listas paralelas** y
dejar una sola fuente que todas las superficies consumen, con candados que impiden que vuelva
a fragmentarse.

## La fuente única

Dos archivos, y nada más decide qué hay en un menú:

- **`src/lib/nav-items.ts`** — los **datos**: las listas por rol (`ADMIN_NAV_ITEMS`,
  `COLEGIO_NAV_ITEMS`, `COMITE_COLEGIO_NAV_ITEMS`, `PADRE_NAV_ITEMS`, `PROFESIONAL_NAV_ITEMS`),
  la superficie anónima (`ANONIMO_NAV_ITEMS`), y la curaduría de la barra móvil
  (`PRINCIPALES_MOVIL`: los ≤4 destinos principales por rol, en orden). Cada ítem lleva
  `href`, `label`, su `modulo` (donde aplica), y opcionalmente `iconKey` (clave de ícono) y
  `labelCorto` (rótulo corto para la barra móvil).
- **`src/lib/nav/para-rol.ts`** — el **resolver** (la compuerta):
  - `navParaRol(rol, ctx) → NavEntry[]` — la nav del rol, **ya gateada**: PARENT sin módulo;
    PROFESIONAL por estado `habilitado` (con override del muro de aceptación); internos/colegio
    por **módulo ∧ proxy** (D-41); anónimo (`rol` nulo) → superficie pública. Devuelve
    `NavEntry { href, label, iconKey, labelCorto?, children? }` — post-compuerta, sin `modulo`.
  - `navMovilParaRol(rol, ctx) → { principales: NavEntry[]≤4, resto: NavEntry[] }` — la partición
    de la barra móvil: intersecta `PRINCIPALES_MOVIL` con la nav gateada (un principal sin módulo
    **cae**, no rebota); `resto` **conserva los grupos** (el «Más» los pinta como sección).
  - `aplanar(items)` — promueve las hojas de los grupos (para barras sin acordeones).

`ctx` = `{ modulosPermitidos?, profesional?, pathname? }`. Los módulos y el estado los pasa cada
**layout** (que sí los tiene); el header global sirve solo la superficie anónima
(`navParaRol(null)`), que no necesita contexto.

## Las 4 superficies (todas CONSUMEN el resolver)

| Superficie | Archivo | Consume | Rol |
|---|---|---|---|
| Barra lateral (escritorio) | `src/components/modules/nav/NavLateral.tsx` | `navParaRol(rol, {modulosPermitidos})` | los 4 roles |
| Barra inferior (móvil) | `src/components/modules/nav/BarraInferior.tsx` | `navMovilParaRol(rol, {modulosPermitidos}).principales` | los 4 roles |
| Hoja «Más» (overflow móvil) | `src/components/modules/nav/HojaMas.tsx` | recibe `resto` por props | los 4 roles |
| Header anónimo | `src/components/modules/NavHeader.tsx` | `navParaRol(null)` | deslogueado |

- Los **íconos** salen de un registro único, `src/components/modules/nav/IconoNav.tsx`, keyed por
  `iconKey` (por defecto = `href`; los grupos `#` llevan una `iconKey` semántica para no colisionar).
- El **estado activo** lo calcula cada superficie con `usePathname` — NO va en el resolver.
- `NavHeader` del **logueado** es solo marca (logo) + avatar de **cuenta** (Cambiar contraseña /
  Cerrar sesión). No tiene hamburguesa ni nav de rol: esa vive en NavLateral (escritorio) y
  BarraInferior (móvil). La superficie **anónima** sí vive en el header, ambos tamaños, sin
  hamburguesa: logo · «Estadísticas públicas» (`/dashboard-publico`) · «Iniciar sesión».

## Los candados (qué impide cada uno)

Viven en `src/lib/nav/para-rol.test.ts` y `src/components/modules/nav-superficie-unica.candado.test.tsx`
(más `src/lib/profesional/menu.candado.test.ts`, SPEC-437).

- **(B) Resolver correcto** — `navParaRol` devuelve la lista + compuerta correcta por rol;
  `navMovilParaRol` respeta `PRINCIPALES_MOVIL` (== mock de Jelkin), ≤4, partición completa y
  disjunta, promoción de hojas, gateado. Incluye la **higiene anti-stale**: cada href de
  `PRINCIPALES_MOVIL` existe en la nav del rol (un typo o ruta muerta → CI roja).
- **(A) Propagación por centinela** — se mockea el resolver a un ítem centinela y se renderiza
  cada superficie; el centinela **debe aparecer**. Una superficie que arme su lista a mano no lo
  reflejaría (control positivo). Prueba conducta, no palabras.
- **Meta-aserción de cobertura** — el conjunto de superficies con prueba de propagación == el
  conjunto que **descubre** el descubridor (por convención). Una superficie nueva que importe el
  resolver sin su prueba → CI roja. Así la enumeración de (A) no es una lista a mano.
- **(C) Barrido anti-quemado (por convención, no allowlist)** — el descubridor toma como
  superficie todo componente que **importa el resolver** o que pinta nav dentro de un elemento
  `<nav>`. Ninguna superficie descubierta puede tener un destino de rol **quemado** (literal); el
  conjunto de «destinos de rol» se **deriva** de `nav-items` (no se enumera a mano). Control
  positivo **sobre el descubridor**: una superficie falsa nueva con lista a mano es cazada.
  Límite aceptado: una nav pintada en un `<div>` plano —sin `<nav>` ni resolver— escapa (es una
  desviación deliberada de la convención de accesibilidad, no un olvido).
- **Avatar sin nav (anti doble-menú)** — el avatar del logueado es solo cuenta; si pintara nav
  (source-driven o a mano), recaería el doble-menú de Jelkin → CI roja.

## Visibilidad ≠ acceso

El resolver decide qué se **MUESTRA** en el menú. **NO** protege la página. Los guardias de
página/route server-side (proxy, `verifyAuth`, layouts) son otra cosa, independientes e intactos.
**Un candado de nav en verde NUNCA significa «la página está cerrada».** Esconder un ítem del menú
no cierra la pantalla.

## Recetas (cómo cambiar la nav sin romper el candado)

- **Agregar/quitar un ítem de un rol:** editá su lista en `nav-items.ts`. Nada más.
- **Cambiar los ≤4 de la barra móvil de un rol:** editá `PRINCIPALES_MOVIL` (data curada por
  Diseño/Jelkin). Es un subconjunto **ordenado**, NO «los primeros 4».
- **Ícono / rótulo corto:** `iconKey` y `labelCorto` en el ítem (`nav-items.ts`); el ícono lo
  resuelve `IconoNav`.
- **Agregar una superficie nueva:** consumí `navParaRol`/`navMovilParaRol` (nunca una lista a
  mano) y **registrala en `SUPERFICIES_CUBIERTAS`** del candado (A) con su prueba de propagación —
  la meta-aserción te obliga (CI roja hasta que lo hagas).
- **Copy de un rótulo:** es autoridad de **Diseño** (vía CEO), certificado contra el mock. No se
  inventa en el código.
