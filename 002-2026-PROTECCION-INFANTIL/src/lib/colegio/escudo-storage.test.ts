/**
 * SPEC-351 (T061) · validación del escudo por MAGIA DE BYTES — el SVG queda
 * afuera aunque venga renombrado (candado CEO 01-09).
 */
import { describe, it, expect } from "vitest";
import { validarEscudo, ESCUDO_TAMANO_MAX_BYTES } from "./escudo-storage";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("validarEscudo (SPEC-351)", () => {
    it("PNG válido pasa", () => {
        expect(validarEscudo(PNG)).toEqual({ ok: true, ext: "png" });
    });
    it("JPG válido pasa", () => {
        expect(validarEscudo(JPG)).toEqual({ ok: true, ext: "jpg" });
    });
    it("SVG rechazado — aunque el nombre diga .png, la magia manda", () => {
        const r = validarEscudo(SVG);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.motivo).toMatch(/SVG/);
    });
    it("archivo vacío rechazado", () => {
        expect(validarEscudo(Buffer.alloc(0)).ok).toBe(false);
    });
    it("más de 500 KB rechazado", () => {
        const gordo = Buffer.concat([PNG, Buffer.alloc(ESCUDO_TAMANO_MAX_BYTES)]);
        const r = validarEscudo(gordo);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.motivo).toMatch(/500 KB/);
    });
});
