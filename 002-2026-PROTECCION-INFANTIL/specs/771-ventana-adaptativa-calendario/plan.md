# Plan · SPEC-771 · ventana adaptativa del riel del calendario

## Compuerta §4 — este plan PARA acá
`spec.md` + `plan.md` son el entregable de DISEÑO. **El CEO aprueba** (y resuelve D-1..D-4 de la spec) **antes** de `tasks.md` + implementación. No se toca código en §4.

## Blast radius (medido en `origin/main`)

| Archivo | Qué cambia |
|---|---|
| `src/components/modules/calendario/fechas.ts` | **+`ventanaAdaptativa(bloques)`** (pura, fuente única). `estiloBloque(minInicio, minFin, railInicioMin)` posiciona relativo a `railInicioMin` (hoy usa `H0`). `H0/H1` pasan a ser **default** (período vacío), no el riel fijo. |
| `src/components/modules/calendario/Rejilla.tsx` | Computa `ventanaAdaptativa` de los bloques del período; `altura`, etiquetas y filas salen de `[railInicioMin, railFinMin]`; propaga `railInicioMin` a `renderBloque(bloque, railInicioMin)` y al `ghost`. |
| `src/components/modules/padre/citas/RejillaMisCitas.tsx` | `renderBloque` recibe `railInicioMin` → `estiloBloque(..., railInicioMin)`. |
| `src/components/modules/padre/citas/RejillaElegirFranja.tsx` | idem (3ª superficie · D-3). |
| `src/components/modules/profesional/CalendarioProfesional.tsx` | `renderBloque` pasa `railInicioMin`; `altura` del overlay desde la ventana; **geometría de arrastre** (puntero→min, popover Y) usa `railInicioMin` (D-1); el **guard de creación `H0/H1` se queda**. |
| `src/components/modules/profesional/calendario/Rejilla.tsx` | `BloqueFranja` → `estiloBloque(..., railInicioMin)`; `OverlayDiaProfesional` `muroTop` relativo a `railInicioMin`. |

**Contrato del cambio de firma:** `estiloBloque` gana un 3er parámetro `railInicioMin`. Barrido de llamadores = 4 (los de arriba). El `renderBloque` de `RejillaCalendario` gana el 2º argumento `railInicioMin` — es un cambio de contrato del componente compartido; los tres consumidores de `renderBloque` se actualizan en el mismo PR.

## `ventanaAdaptativa` — contrato (pura, testeable)

Entrada: los bloques `{minInicio, minFin}` del período VISIBLE (no todo el `Map`; solo `diasVisibles`). Salida `{ inicioMin, finMin }`:
1. Sin bloques → default legible (D-2, por superficie vía parámetro).
2. `crudoInicio = min(minInicio)`, `crudoFin = max(minFin)`.
3. `inicio = floorAFrontera(crudoInicio) − MARGEN`; `fin = ceilAFrontera(crudoFin) + MARGEN` (frontera = 30 min; `MARGEN ≈ 30`).
4. Span mínimo: si `fin − inicio < MIN_SPAN` (~4–6 h) → expandir centrado hasta `MIN_SPAN` (nunca recortar: si el contenido excede `MIN_SPAN`, manda el contenido).
5. Clamp a `[0, 24h]`.
`PXH` NO entra acá (la escala es constante; sólo cambia el rango). El default vacío entra como parámetro para no cablear la política de superficie dentro del helper.

## Candado (tras aprobación §4)

- **Unit** (`fechas` · `ventanaAdaptativa`): A-3, A-4 (property de escala), A-5, A-6 — bordes/margen/redondeo/mínimo/vacío/outlier. Sin BD, sin render.
- **Render, DOS superficies** (`*.candado.test.tsx`): PLANTA (props, sin BD) una cita a las **5am** y otra a las **21:00**; monta `RejillaMisCitas` **y** `CalendarioProfesional` (+ `RejillaElegirFranja`, D-3); afirma por cada bloque `top ≥ 0 && top+height ≤ altura` (**dentro del área visible**, no «en el DOM»). Mutación de control: forzar el riel fijo (`railInicioMin = H0`) → los bordes salen del área → ROJO.
- **No reconciliar (D-4):** correr `calendario-padre.candado.test.tsx` existente; si se pone rojo por la ventana adaptativa, es **hallazgo** → se reporta, no se ajusta en silencio.
- **Barrido de llamadores** de `estiloBloque`: el candado/tsc garantiza que los 4 pasan `railInicioMin` (un llamador olvidado dejaría esa superficie con el riel viejo).

## Gate de calidad (al implementar)
`tsc` + `lint` + `test:unit` COMPLETO (specs-discipline exige `**Impacto en arquitectura:**` + Status + plan + tasks) + los render candados en la lane de integración + `build` compila. Verificar por **exit code**.

## Secuencia
§4 (este doc) → **PARÁ, aprobación CEO** → `tasks.md` con casillas → `ventanaAdaptativa` + firma de `estiloBloque` → `RejillaCalendario` propaga → 4 consumidores → candados (unit + render dos superficies) → gate de calidad → PR.

## No depende de
`#746` (767, en compuerta del CEO) — 771 sale de `main`, no toca los archivos de 767. Tampoco toca 749 FR-2 (mismo archivo `EsperaCitaPanel`/`RejillaMisCitas` pero distinto eje: 749 es el estado/copy, 771 es la geometría del riel; el único solape es `RejillaMisCitas.tsx`, ya en `main` con 749). SPEC-773 (sembradores) ya en `main` — por eso el candado PLANTA.
