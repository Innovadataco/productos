# SPEC-455 · «Cara» del rediseño: el dashboard público sin alarma

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: paquete de Diseño (idc-04) · orden de Jelkin (activar Diseño hoy) · **Autoridad de diseño**: Diseño (certifica al cierre)

**Impacto en arquitectura:** ninguno de API/modelo/datos. Se cablea una paleta que ya existía (SPEC-370) y se tokeniza el mueble compartido «la gráfica» (toca toda pantalla que use `DonutChart`/`BarChart`, no solo el dashboard).

---

## El defecto (chico, no un rediseño)

El dashboard público es **abierto** (Jelkin, 04-09: es para todos, incluido un padre asustado), pero pintaba el **rojo de alarma** (`#ef4444`) en el mapa y las gráficas. Rompe la regla dura del sistema de diseño: **nunca rojo** salvo `rubi` de criticidad real.

## Qué se hizo

1. **Mapa — paleta sin alarma.** `PublicDashboard` pasa `paleta="padre"` al `<MapaUbicaciones>`. La paleta `COLORES_PADRE` (ámbar/pino) ya existía (SPEC-370); estaba a medias cableada: solo los pines la miraban. Se enhebró `paleta` también por los **rellenos del choropleth** (`paisStyle` + mouseout) y por la **leyenda** — que seguían en `COLORES` (riesgo). Diseño ya lo había anticipado («verificar que el componente la reciba y la aplique a pines/leyenda»).
2. **La gráfica es un MUEBLE (catálogo §4).** `DonutChart` y `BarChart` son compartidas (también la home del colegio). Su paleta migra a tokens: serie categórica en `pino`/`cielo`/`ambar` + derivados por `color-mix`, **nunca rojo** (`rubi` solo para criticidad nombrada); textos SVG a `fill-current` + `text-muted`/`text-body`; etiquetas en versalita. Se fue el `#ef4444` del donut y el `sky/cyan` de la barra.
3. **Voz — «tú», para todos.** Título y subtítulo del dashboard, de lenguaje de inversionista a voz cálida (copy de Diseño).

## Candados

- `tokens:check`: piso **1079 → 1065** (14 clases crudas menos; ratchet bajado).
- `graficas-y-mapa-sin-alarma.candado.test.ts` (fuente, sin BD): las gráficas no traen color crudo (barrido, no solo esta pantalla); el dashboard cablea `paleta="padre"`; el mapa aplica la paleta a rellenos **y** leyenda. Contraprueba por mutación en tres direcciones, cada una con rojo distinto.

## Certificación (la da DISEÑO)

Diseño revisa el dashboard público contra producción tras desplegar y certifica que el rojo de alarma salió y la voz quedó cálida. Hasta esa certificación, la «cara» no se marca cerrada en el inventario.
