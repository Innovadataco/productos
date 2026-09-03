/**
 * SPEC-392 (L3) · candado H-4 · veredicto CEO 07:10 (sesión estable).
 * El shuffle determinístico es el que evita marear al padre al filtrar.
 */
import { describe, it, expect } from "vitest";
import { barajarConSemilla, SEED_MIN_LENGTH } from "./directorio-shuffle";

const items = Array.from({ length: 12 }, (_, i) => ({ id: `id-${String(i + 1).padStart(2, "0")}` }));

describe("barajarConSemilla", () => {
    it("mismo (items, seed) → mismo orden", () => {
        const a = barajarConSemilla(items, "sesion-A-11111111").map((x) => x.id);
        const b = barajarConSemilla(items, "sesion-A-11111111").map((x) => x.id);
        expect(a).toEqual(b);
    });

    it("distinto seed → distinto orden (baraja de verdad)", () => {
        const a = barajarConSemilla(items, "sesion-A-11111111").map((x) => x.id);
        const b = barajarConSemilla(items, "sesion-B-22222222").map((x) => x.id);
        expect(a).not.toEqual(b);
    });

    it("no muta la entrada", () => {
        const clon = items.map((x) => ({ ...x }));
        barajarConSemilla(clon, "sesion-C-33333333");
        expect(clon.map((x) => x.id)).toEqual(items.map((x) => x.id));
    });

    it("conserva el mismo conjunto de ids", () => {
        const salida = barajarConSemilla(items, "sesion-D-44444444");
        expect(new Set(salida.map((x) => x.id))).toEqual(new Set(items.map((x) => x.id)));
        expect(salida.length).toBe(items.length);
    });

    it(`rechaza seeds de menos de ${SEED_MIN_LENGTH} caracteres`, () => {
        expect(() => barajarConSemilla(items, "")).toThrow();
        expect(() => barajarConSemilla(items, "abc")).toThrow();
    });

    it("lista vacía queda vacía", () => {
        expect(barajarConSemilla([], "sesion-vacia-1111")).toEqual([]);
    });
});
