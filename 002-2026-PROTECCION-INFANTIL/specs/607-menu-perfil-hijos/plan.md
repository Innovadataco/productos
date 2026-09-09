# SPEC-607 · Plan

## Enfoque

Tres frentes independientes sobre el mockup aprobado (`design/expediente-final-mockup.html`):

1. **Menú**: `PADRE_NAV_ITEMS` se reescribe a 6 entradas con `children` (patrón ya usado por «Usuarios» del colegio). El lateral gana grupos colapsables que nacen expandidos; la barra móvil aplana (`flatMap(item => item.children ?? [item])`) — una lista única, cero listas paralelas.
2. **Mi perfil**: la página absorbe el contenido de las otras dos. Se eligieron `<details>`/`<summary>` NATIVOS (lo que pide el mockup: «tres acordeones `<details>` nativos, sin JavaScript») sobre el `Accordion` de SPEC-146: la URL con ancla abre el acordeón sola en el navegador y la página queda 100 % server component. Las rutas viejas pasan a `redirect()` de servidor conservando `?bienvenida=1`.
3. **Hijos sin documento**: nada que construir — SPEC-589 ya eliminó las columnas y SPEC-601/589 limpiaron formulario y API. Se aporta el candado de UI (`FormularioAltaHijo.test.tsx`) que faltaba.

## Decisiones

1. **Grupos nacen expandidos**: «Reportar» queda a un clic en el primer render (I-38); el chevron colapsa pero el estado inicial nunca esconde la acción crítica. Padre del grupo = botón (href `#`, patrón «Usuarios» del colegio), no enlace: el primer hijo repite el destino («Reportar» → `/dashboard/padre/reportar`).
2. **El `destino` del guardián de vigencia NO se mueve**: sigue `/dashboard/padre/suscripcion` (exenta), que redirige a `/dashboard/padre/perfil#suscripcion`. Lo que SÍ se exime es `/dashboard/padre/perfil` — sin eso hay bucle guardián→redirect→guardián (clase I-25, la invariante cruzada lo documenta). `/api/notificaciones` se exime para que el acordeón funcione también sin plan.
3. **Suscripción abierta por defecto sin cobertura**: como el guardián aterriza al padre sin plan en esta página (vía el redirect), el acordeón «Suscripción» nace `open` cuando no hay ACTIVA/EN_GRACIA — el selector de planes queda a la vista sin depender del ancla.
4. **Acordeones con ids `general`/`notificaciones`/`suscripcion`**: son el contrato de los redirects con ancla; los tests los fijan.
5. **Sin migración**: el schema ya refleja «hijos sin documento» (SPEC-589). La premisa del brief (columnas NOT NULL con unique compuesto) estaba desactualizada respecto a main.

## Riesgos

- **Bucle de vigencia** (alto si se olvida la exención): mitigado con la exención de `/dashboard/padre/perfil` + tests del guardián en verde.
- **Enlaces viejos rotos**: mitigado con redirects de servidor con ancla + tests de redirect.
- **Server actions de pago**: se mueven intactas a la página de perfil revalidando la ruta nueva; POST a ruta de página exenta → el flujo freemium/bono sigue sin tocar el muro.
