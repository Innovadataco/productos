# Research: Gantt interactivo

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

## D1 · La inversa, en su propio módulo

SPEC-015 dejó la ida (fecha→fracción) en `gantt.ts`. El arrastre necesita la vuelta
(fracción→fecha) y el cálculo de nuevas fechas. Va en `ganttInteractivo.ts`, separado, para que
SC-003 ("la math de 015 no se rompe") sea literal: `gantt.ts` no se edita. Ambos puros y
testeados; el componente solo aporta el estado del ratón.

## D2 · Dependencias polimórficas por id de item

Los items del Gantt ya tienen id prefijado (`entregable:x`, `hito:y`). `dependeDe` guarda ese
id. Así una dependencia cruza tipos sin FK polimórfica, y una referencia colgada no rompe:
`detectarConflictos` no encuentra el predecesor y no marca conflicto. Alternativa (FK
self-referencial por tabla) no permite cruzar tipos.

## D3 · Pointer capture, no listeners globales

El arrastre usa `setPointerCapture` en la barra: los `pointermove`/`pointerup` siguen llegando
a ese elemento aunque el cursor salga. Evita añadir/quitar listeners de `window` en un efecto
(que roza §6.2) y las cadenas de dependencias de closures.

## D4 · Solo señalar, no reprogramar (RZ-5)

`detectarConflictos` devuelve el conjunto de ids a marcar y **no toca fechas**. La
reprogramación en cascada (mover A recoloca sus dependientes) es otra spec: potente y con
riesgo de sorpresas, se deja fuera a propósito.

## Abierto

- Reprogramación automática en cascada (otra spec).
- Arrastre táctil (como el Kanban, mejora futura).
- Dependencias inicio→inicio / fin→fin.
