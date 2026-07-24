# Research: Gantt del cronograma

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

## D1 · Matemática pura, dominio en el adaptador

El Gantt es dos cosas: colocar rectángulos en el tiempo (matemática) y saber qué rectángulo es
cada entregable/hito (dominio). Se separan: `gantt.ts` no conoce el dominio y devuelve
fracciones 0..1; `ganttAdaptador.ts` traduce entregables/hitos a `ItemGantt`. Es lo que permite
que 016 reutilice la matemática sin tocarla y que ambas se prueben sin lienzo.

## D2 · `fechaInicio` en el entregable

El hito tiene `fecha`/`fechaFin`; el entregable solo `fechaCompromiso`. Sin un inicio, la barra
del entregable no tiene de dónde salir. Se añade `fechaInicio` (opcional, aditiva). Los
existentes usan `createdAt` como inicio para no perderlos ni exigir backfill. La alternativa
—`createdAt` siempre— es semánticamente pobre (createdAt es cuándo se registró, no cuándo
empieza el trabajo) y dejaría a 016 sin un inicio real que arrastrar.

## D3 · Cero librerías

Un Gantt de barras y rombos es posicionamiento absoluto por porcentaje. `frappe-gantt` o
`dhtmlx-gantt` son decenas de kB y un modelo de datos propio, para algo que Tailwind hace en un
componente. Mismo criterio que el Kanban. Si 016 (arrastre con snap y dependencias) revelara
que una librería ahorra riesgo real, se para y se deja nota; no se instala por comodidad.

## D4 · "Hoy" como parámetro

`posicionHoy(rango, hoy)` y `rangoDeItems(items, hoy)` reciben la fecha, no la leen: los tests
son deterministas. El componente la computa una vez en un inicializador perezoso de `useState`
(no en render, que sería impuro).

## Abierto

- Exportar el Gantt (PDF/imagen): otro frente si el negocio lo pide.
- Zoom continuo en vez de tres escalas fijas.
