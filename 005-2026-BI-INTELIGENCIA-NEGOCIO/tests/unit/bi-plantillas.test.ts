import { describe, it, expect } from "vitest";
import { elegirPlantilla } from "@/lib/bi/plantillas";

describe("elegirPlantilla (candado 10)", () => {
    it("0 filas → sin-datos", () => {
        const r = elegirPlantilla([]);
        expect(r.plantilla).toBe("sin-datos");
        expect(r.respuestaNarrativa).toMatch(/no hay datos/i);
    });

    it("[{total:42}] → un-numero", () => {
        const r = elegirPlantilla([{ total: 42 }]);
        expect(r.plantilla).toBe("un-numero");
        expect(r.respuestaNarrativa).toContain("42");
    });

    it("5 filas categoria+count → grafico bar", () => {
        const r = elegirPlantilla([
            { categoria: "A", count: 3 },
            { categoria: "B", count: 5 },
            { categoria: "C", count: 1 },
            { categoria: "D", count: 8 },
            { categoria: "E", count: 2 },
        ]);
        expect(r.plantilla).toBe("grafico");
        const spec = r.graficoSpec as Record<string, unknown>;
        expect(spec.mark).toBe("bar");
    });

    it("100 filas → tabla", () => {
        const filas = Array.from({ length: 100 }, (_, i) => ({
            categoria: `cat${i}`,
            n: i,
        }));
        const r = elegirPlantilla(filas);
        expect(r.plantilla).toBe("tabla");
    });

    it("1 fila con clave no numérica → tabla", () => {
        const r = elegirPlantilla([{ nombre: "Ana" }]);
        expect(r.plantilla).toBe("tabla");
    });
});
