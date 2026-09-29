/**
 * CANDADO · SPEC-771 — la ventana del riel es ADAPTATIVA: NINGUNA cita/franja del período queda
 * fuera del área visible. Antes, un riel fijo 7am–9pm (`H0..H1`) posicionaba una cita de 5am con
 * `top` negativo (fuera de vista) — «en el DOM, no visible». Este candado afirma que cae DENTRO
 * del área visible (`0 ≤ top` y `top+height ≤ altura`), y el CONTROL POSITIVO por mutación es el
 * riel fijo: con `railInicioMin = H0` la de 5am vuelve a `top` negativo → ROJO.
 *
 * Unit puro (geometría, sin BD, sin render). Cubre las DOS reglas de superficie:
 *  · Padre (mira/elige): ventana = puro contenido; vacío → 8am–6pm.
 *  · Profesional (crea): ventana = UNIÓN con la banda creable 7am–9pm (nunca esconde horas creables).
 */
import { describe, it, expect } from "vitest";
import { ventanaAdaptativa, estiloBloque, PXH, H0, DEFAULT_VACIO_PADRE, BANDA_CREABLE } from "./fechas";

const PADRE = { defaultVacioMin: DEFAULT_VACIO_PADRE };
const PROF = { bandaMinimaMin: BANDA_CREABLE, defaultVacioMin: BANDA_CREABLE };
const alturaDe = (v: { inicioMin: number; finMin: number }) => ((v.finMin - v.inicioMin) / 60) * PXH;
// ¿el bloque cae DENTRO del área visible del riel? (no arriba, no debajo)
function dentro(minInicio: number, minFin: number, v: { inicioMin: number; finMin: number }): boolean {
    const { top, height } = estiloBloque(minInicio, minFin, v.inicioMin);
    return top >= 0 && top + height <= alturaDe(v) + 0.01;
}

const CITA_5AM: [number, number] = [5 * 60, 5 * 60 + 45];
const CITA_9PM: [number, number] = [21 * 60, 21 * 60 + 45];

describe("SPEC-771 · ventanaAdaptativa — ninguna cita fuera del área visible", () => {
    it("PADRE · una cita de 5am cae DENTRO del área visible (antes: top negativo)", () => {
        const v = ventanaAdaptativa([{ minInicio: CITA_5AM[0], minFin: CITA_5AM[1] }], PADRE);
        expect(v.inicioMin).toBeLessThanOrEqual(CITA_5AM[0]);
        expect(dentro(CITA_5AM[0], CITA_5AM[1], v)).toBe(true);
    });

    it("PADRE · una cita de 9pm cae DENTRO (no debajo del riel)", () => {
        const v = ventanaAdaptativa([{ minInicio: CITA_9PM[0], minFin: CITA_9PM[1] }], PADRE);
        expect(dentro(CITA_9PM[0], CITA_9PM[1], v)).toBe(true);
    });

    it("CONTROL POSITIVO (mutación): con el riel FIJO (railInicioMin=H0) la de 5am queda ARRIBA (top<0)", () => {
        const { top } = estiloBloque(CITA_5AM[0], CITA_5AM[1], H0 * 60);
        expect(top).toBeLessThan(0); // el defecto que se está cerrando
        // y con la ventana adaptativa deja de estarlo:
        const v = ventanaAdaptativa([{ minInicio: CITA_5AM[0], minFin: CITA_5AM[1] }], PADRE);
        expect(estiloBloque(CITA_5AM[0], CITA_5AM[1], v.inicioMin).top).toBeGreaterThanOrEqual(0);
    });

    it("PROFESIONAL · el riel SIEMPRE incluye la banda creable 7am–9pm (D-2)", () => {
        const v = ventanaAdaptativa([{ minInicio: 14 * 60, minFin: 15 * 60 }], PROF);
        expect(v.inicioMin).toBeLessThanOrEqual(BANDA_CREABLE[0]); // ≤ 7am
        expect(v.finMin).toBeGreaterThanOrEqual(BANDA_CREABLE[1]); // ≥ 9pm
    });

    it("PROFESIONAL · una franja de 6am EXPANDE el riel hacia abajo, sin perder la banda", () => {
        const v = ventanaAdaptativa([{ minInicio: 6 * 60, minFin: 6 * 60 + 45 }], PROF);
        expect(v.inicioMin).toBeLessThanOrEqual(6 * 60); // se ve la de 6am
        expect(v.finMin).toBeGreaterThanOrEqual(BANDA_CREABLE[1]); // sigue incluyendo hasta 9pm
        expect(dentro(6 * 60, 6 * 60 + 45, v)).toBe(true);
    });

    it("período VACÍO → default por superficie (padre 8am–6pm · profesional 7am–9pm)", () => {
        expect(ventanaAdaptativa([], PADRE)).toEqual({ inicioMin: 8 * 60, finMin: 18 * 60 });
        expect(ventanaAdaptativa([], PROF)).toEqual({ inicioMin: 7 * 60, finMin: 21 * 60 });
    });

    it("SPAN MÍNIMO · una cita corta NO deja un riel sliver (se expande, no recorta)", () => {
        const v = ventanaAdaptativa([{ minInicio: 14 * 60, minFin: 14 * 60 + 45 }], PADRE);
        expect(v.finMin - v.inicioMin).toBeGreaterThanOrEqual(5 * 60);
        expect(dentro(14 * 60, 14 * 60 + 45, v)).toBe(true); // el contenido nunca se recorta
    });

    it("ESCALA CONSISTENTE · un bloque de 45 min mide igual en ventanas distintas", () => {
        const chica = ventanaAdaptativa([{ minInicio: 14 * 60, minFin: 14 * 60 + 45 }], PADRE);
        const ancha = ventanaAdaptativa([{ minInicio: 6 * 60, minFin: 6 * 60 + 45 }, { minInicio: 20 * 60, minFin: 20 * 60 + 45 }], PROF);
        const h1 = estiloBloque(14 * 60, 14 * 60 + 45, chica.inicioMin).height;
        const h2 = estiloBloque(20 * 60, 20 * 60 + 45, ancha.inicioMin).height;
        expect(h1).toBe(h2); // la escala (PXH) no cambia con el rango
    });

    it("OUTLIER lejano · 6am + tarde → el riel muestra ambos, ninguno recortado", () => {
        const bloques = [{ minInicio: 6 * 60, minFin: 6 * 60 + 45 }, { minInicio: 15 * 60, minFin: 16 * 60 }];
        const v = ventanaAdaptativa(bloques, PADRE);
        for (const b of bloques) expect(dentro(b.minInicio, b.minFin, v), `bloque ${b.minInicio} recortado`).toBe(true);
    });
});
