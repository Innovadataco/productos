/**
 * CANDADO · SPEC-964 (FORMA Órbita · PARÁ 1 / PARÁ 3) — color del NODO DE CURSO en el overview.
 *
 * Muere con el defecto:
 *   - PARÁ 1: un nodo de RESUMEN (curso) solo pinta pino/ámbar, NUNCA rubí (D-120/SPEC-566). Si
 *     `colorCursoOrbita` devolviera rubí, el `toContain` sobre {pino, ámbar} se pone rojo. (El tipo
 *     de retorno ya lo prohíbe en compilación; este candado lo amarra también en runtime.)
 *   - PARÁ 3: el corte calma↔mirada se LEE del umbral, no está quemado: el MISMO curso cambia de
 *     color al mover el umbral. Si el color ignorara el umbral, una de estas aserciones fallaría.
 */
import { describe, it, expect } from "vitest";
import { colorCursoOrbita } from "./semaforo";
import { CURSO_MIRADA_UMBRAL_DEFAULT } from "./curso-mirada";

const SOLO_RESUMEN = ["pino", "ambar"];

describe("SPEC-964 · color del curso en el overview (pino/ámbar, nunca rubí)", () => {
    it("PARÁ 1: nunca rubí — ni al cruzar ni muy por encima del umbral", () => {
        const combos: Array<[alertas: number, umbral: number]> = [
            [0, 1], [1, 1], [5, 1], [1, 3], [3, 3], [99, 2], [0, 10], [2, 1],
        ];
        for (const [alertas, umbral] of combos) {
            expect(SOLO_RESUMEN, `alertas=${alertas} umbral=${umbral}`).toContain(colorCursoOrbita(alertas, umbral));
        }
    });

    it("cero reportes es SIEMPRE pino (en calma), aun con umbral degenerado", () => {
        expect(colorCursoOrbita(0, 1)).toBe("pino");
        expect(colorCursoOrbita(0, 0)).toBe("pino");
        expect(colorCursoOrbita(0, 99)).toBe("pino");
    });

    it("PARÁ 3: el UMBRAL manda — el MISMO curso cambia de color al mover el umbral", () => {
        // 2 reportes: ámbar con umbral 1–2, pino con umbral 3+. Mutación: si el umbral no se
        // leyera (corte quemado), la tercera aserción fallaría.
        expect(colorCursoOrbita(2, 1)).toBe("ambar");
        expect(colorCursoOrbita(2, 2)).toBe("ambar");
        expect(colorCursoOrbita(2, 3)).toBe("pino");
    });

    it("el default (=1) reproduce «merecen mirada» de hoy: ≥1 reporte = ámbar, 0 = pino", () => {
        expect(colorCursoOrbita(0, CURSO_MIRADA_UMBRAL_DEFAULT)).toBe("pino");
        expect(colorCursoOrbita(1, CURSO_MIRADA_UMBRAL_DEFAULT)).toBe("ambar");
    });
});
