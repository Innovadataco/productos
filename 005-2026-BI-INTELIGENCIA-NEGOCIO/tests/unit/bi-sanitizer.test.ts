import { describe, it, expect } from "vitest";
import { sanearFilas } from "@/lib/bi/sanitizer";

describe("sanearFilas (candado 13)", () => {
    it("enmascara teléfono CO", () => {
        const r = sanearFilas([{ nombre: "Ana 3001234567" }]);
        expect(r.filas[0].nombre).toBe("Ana ***teléfono***");
        expect(r.piiDetectada).toBe(true);
    });

    it("enmascara email", () => {
        const r = sanearFilas([{ contacto: "user@example.com dice hola" }]);
        expect(r.filas[0].contacto).toBe("***email*** dice hola");
    });

    it("enmascara cédula solo en columna documento", () => {
        const r = sanearFilas([{ documento: "1023456789" }]);
        expect(r.filas[0].documento).toBe("***documento***");
    });

    it("no enmascara número en columna total_reportes", () => {
        const r = sanearFilas([{ total_reportes: "1023456789" }]);
        expect(r.filas[0].total_reportes).toBe("1023456789");
        expect(r.piiDetectada).toBe(false);
    });

    it("deja intactos valores no-string", () => {
        const r = sanearFilas([{ n: 42, activo: true }]);
        expect(r.filas[0]).toEqual({ n: 42, activo: true });
    });

    it("es idempotente sobre filas ya limpias", () => {
        const filas = [{ categoria: "bullying", total: 5 }];
        const r = sanearFilas(filas);
        expect(r.piiDetectada).toBe(false);
        expect(r.filas).toEqual(filas);
    });
});
