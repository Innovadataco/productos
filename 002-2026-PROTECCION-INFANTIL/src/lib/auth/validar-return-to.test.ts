import { describe, it, expect } from "vitest";
import { validarReturnTo, DEFAULT_RETURN_TO } from "./validar-return-to";

describe("validarReturnTo (SPEC-310)", () => {
    it("acepta host de producción permitido (https)", () => {
        expect(validarReturnTo("https://bi.innovadataco.com/dashboard")).toBe(
            "https://bi.innovadataco.com/dashboard"
        );
    });

    it("acepta cualquier ruta interna del host de producción", () => {
        expect(validarReturnTo("https://bi.innovadataco.com/reportes")).toBe(
            "https://bi.innovadataco.com/reportes"
        );
    });

    it("acepta host de desarrollo permitido (http)", () => {
        expect(validarReturnTo("http://localhost:3001/dashboard")).toBe("http://localhost:3001/dashboard");
    });

    it("acepta host de desarrollo permitido (https)", () => {
        expect(validarReturnTo("https://localhost:3001/dashboard")).toBe("https://localhost:3001/dashboard");
    });

    it("rechaza host ajeno y devuelve el default", () => {
        expect(validarReturnTo("https://atacante.com/robar")).toBe(DEFAULT_RETURN_TO);
    });

    it("rechaza esquema javascript: y devuelve el default", () => {
        expect(validarReturnTo("javascript:alert(1)")).toBe(DEFAULT_RETURN_TO);
    });

    it("rechaza URL protocol-relative y devuelve el default", () => {
        expect(validarReturnTo("//atacante.com")).toBe(DEFAULT_RETURN_TO);
    });

    it("rechaza el host de producción con protocolo http (solo https permitido en prod) y devuelve el default", () => {
        expect(validarReturnTo("http://bi.innovadataco.com/dashboard")).toBe(DEFAULT_RETURN_TO);
    });

    it("rechaza puerto distinto al permitido en localhost y devuelve el default", () => {
        expect(validarReturnTo("http://localhost:3000/dashboard")).toBe(DEFAULT_RETURN_TO);
    });

    it("returnTo ausente → default", () => {
        expect(validarReturnTo(null)).toBe(DEFAULT_RETURN_TO);
        expect(validarReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
        expect(validarReturnTo("")).toBe(DEFAULT_RETURN_TO);
    });

    it("returnTo malformado → default", () => {
        expect(validarReturnTo("no-es-una-url")).toBe(DEFAULT_RETURN_TO);
    });
});
