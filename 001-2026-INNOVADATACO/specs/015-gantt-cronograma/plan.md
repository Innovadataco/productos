# Implementation Plan: Gantt del cronograma (solo lectura)

**Branch**: `feature/001-scaffolding` (dir: `015-gantt-cronograma`) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Dibujar entregables (barras con avance) e hitos (rombos/rangos) en una línea de tiempo, con
escala día/semana/mes y línea de HOY. **Cero dependencias** (SVG/CSS propio). La matemática de
posición va en una **función pura testeada** para que SPEC-016 monte el arrastre encima.

## Decisión: la matemática es pura y agnóstica del dominio (RZ-2 / SC-003)

`src/lib/gantt.ts` habla de `ItemGantt` (barra/rombo con inicio/fin), no de entregables ni
hitos. Devuelve **fracciones 0..1** del ancho del rango; el componente las multiplica por su
ancho en píxeles. Así el cálculo se prueba sin DOM y el arrastre de 016 reusa las mismas
funciones (`fraccion`, `posicionItem`, `posicionHoy`, `ticks`). El adaptador
(`ganttAdaptador.ts`) traduce el dominio; también puro y testeado.

## Decisión: el entregable gana `fechaInicio` (aditiva)

Un Gantt necesita inicio y fin por barra. El hito los tiene; el entregable solo tenía
`fechaCompromiso`. Se añade `fechaInicio` opcional:
- Barra de `fechaInicio ?? createdAt` a `fechaCompromiso`.
- Existentes sin `fechaInicio` usan `createdAt`: ninguno desaparece, cero backfill.
- Deja a 016 un inicio **persistible** que arrastrar (no un `createdAt` de sistema).

**Alternativa descartada**: usar siempre `createdAt` como inicio. Semánticamente pobre y 016 no
tendría un inicio real que mover.

## Decisión: SVG/CSS propio, cero librerías (RZ-1)

Tailwind + posicionamiento absoluto por porcentaje basta. Una librería de Gantt
(`frappe-gantt`, `dhtmlx`) sería decenas de kB para dibujar barras y rombos, en un producto sin
ninguna librería de este tipo. Mismo criterio que el Kanban (arrastre nativo). Si 016 revelara
que hace falta, se **para y se deja nota** — no se instala a la ligera.

## Constitution Check — **PASS**

| Principio | Evaluación |
|---|---|
| §0.2 Pruebas | ✅ `gantt.ts` y `ganttAdaptador.ts` puros y con test. |
| §0.7 Config | ✅ La escala es del usuario; los datos, del proyecto. |
| §6.2 React | ✅ "Hoy" en inicializador perezoso de `useState` (una vez), sin setState en efecto. |
| §6.3 Estilos | ✅ Solo Tailwind; SVG/CSS propio, sin librerías. |

## Cambios exactos

| Archivo | Qué |
|---|---|
| `prisma/schema.prisma` + migración | `Entregable.fechaInicio` (nullable, aditiva) |
| `src/lib/entregable.ts` (+test) | Validar/normalizar `fechaInicio`; fin no anterior al inicio |
| `src/lib/gantt.ts` (+test) | Matemática pura: rango, fracción, posición, hoy, ticks |
| `src/lib/ganttAdaptador.ts` (+test) | Entregables/hitos → `ItemGantt` |
| `src/components/proyectos/GanttProyecto.tsx` | Render SVG/CSS con la math pura |
| `src/components/proyectos/GestionPm2.tsx` | Pestaña "Gantt" |
| `src/components/proyectos/EntregablesProyecto.tsx` | Campo `fechaInicio` en el form |

## Verificación por requisito

| FR | Cómo |
|---|---|
| FR-001 | Barras/rombos/avance a la vista, en el contenedor |
| FR-002 | Conmutar escala; `ticks` con test por escala |
| FR-003 | `posicionHoy` con test (dentro/fuera de rango) |
| FR-004 / RZ-1 | `git diff` de `package.json` vacío |
| FR-006 / SC-005 | Migración ensayada; barra desde `fechaInicio ?? createdAt` |
| SC-003 | `gantt.ts` con 18 tests, separada del render |

## Riesgos

- **R-01 · `new Date()` en render** (react-hooks/purity). Mitigación: inicializador perezoso de
  `useState`, se ejecuta una vez.
- **R-02 · Migración sobre datos vivos.** Aditiva, nullable, ensayada; existentes usan
  `createdAt`.
- **R-03 · Escala mes con rango de años** genera muchos ticks. Con el volumen actual no es
  problema; si crece, se acota.
