# SPEC-362 · Cierre — forma y guía del lote A-70 (G13–G17, G21) + I-256

**Fecha**: 01-09-2026 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-362-forma-planes-listo-menu-pie`

## I-256 · El 201 que no movía la pantalla

Calidad lo vio en prod: el consentimiento **se guardaba** (201) y el padre se
quedaba en la misma página, volviendo a hacer clic. Entrando a mano, la app
funcionaba — el estado estaba sano; faltaba la reacción.

La causa está en el destino: `/dashboard/padre` lo evalúa el middleware con la
cookie `sesion_estado` que **esa misma respuesta acaba de renovar**, y lo reenvía
al paso del camino. Una navegación de cliente puede resolverse contra el estado
anterior y quedarse donde está. Ahora se hace `window.location.assign`: un
request nuevo, con la cookie nueva, y el guardián decide con el estado ya
actualizado.

El test viejo espiaba `router.push` — el mock tapaba justo lo que falló. Ahora se
espía `window.location.assign`, que es el mecanismo real.

## G13 · La pantalla de planes

Dos defectos distintos:

- **Los nombres técnicos** ("PADRE · MES_6 · 2026", "(precio placeholder)")
  vienen de la fila del `Plan` en base de datos. Un UPDATE en producción tapa el
  síntoma de hoy y deja la puerta abierta; se resolvió en la presentación con
  `nombre-plan-humano.ts`: si el texto guardado tiene forma de clave interna, la
  pantalla muestra el nombre derivado de la duración ("6 meses").
  **El test de SPEC-355 cazó un falso positivo de esa regla antes de llegar a
  producción**: mi primera versión trataba "Colegio Anual" como jerga (por la
  palabra "Colegio") y lo habría borrado de la pantalla. La señal quedó acotada a
  lo inequívoco: `MES_<n>` y "placeholder".
- **La forma**: eran 4 columnas fijas; con 4-5 tarjetas el texto caía en columnas
  de una palabra y los botones quedaban cortados. Ahora la grilla es
  `auto-fit / minmax(230px, 1fr)` y el precio no desborda.

Reproducido en dev sembrando los nombres técnicos de producción, y verificado
después: cero jerga en pantalla aunque la base la tenga.

## G14 · Pantalla "Listo"

Los tres botones sueltos pasaron a tarjetas que explican qué es cada opción, con
el paso principal (ir al panel) destacado.

## G15 · Señal de scroll

"Sigue bajando para poder aceptar" con flecha animada sobre un degradado; se
apaga sola al llegar al final y `motion-reduce` la deja quieta. Va de la mano de
SPEC-358: el botón solo se enciende al final, y hasta hoy nada lo decía.

## G16 · Menú apagado durante el camino

"Mi panel", "Círculo" y "Mis reportes" se pintan en gris, sin acción y con la
razón en el `title`. Cambiar contraseña y cerrar sesión siguen vivos: son las dos
salidas que nadie puede perder.

## G17 · Verde y gris

Verde = activo (con punto), gris = inactivo. Nunca rojo.

## G21 · Pie global

`PieGlobal` en el layout raíz: "Desarrollado por Innovadataco · V1" más la
versión de `package.json` y el SHA que el Dockerfile inyecta en `APP_BUILD_SHA`.
Nadie escribe la versión a mano, así que no queda mintiendo tras una subida.

## Extras del CEO

- **I-250 · voseo**: "Podés hacerlo de forma anónima" → "Puedes".
- **F4 · apellidos** (hallazgo de Dev PI-1): el formulario dejaba enviar sin
  apellidos y el servidor respondía 400. Se validan en el cliente nombrando el
  campo, y el campo quedó marcado como requerido. Se decidió **obligatorio**
  porque salen en el expediente y en los informes (SPEC-339 · FR-019).

## Gate

`tsc` limpio · lint **0 errores** · unit **1942/1942** · `next build` verde ·
`arch:check` VERDE. Verificado en vivo: G13 sin jerga, G15 aparece y se apaga
sola, G21 con versión visible.
