import { describe, it, expect } from "vitest";
import { inferirTipoIdentificador } from "./normalizacion";

describe("inferirTipoIdentificador", () => {
    it("infiere email cuando el valor contiene @", () => {
        expect(inferirTipoIdentificador("padre@correo.com")).toBe("email");
    });

    it("infiere telefono con formato E.164", () => {
        expect(inferirTipoIdentificador("+573001234567")).toBe("telefono");
    });

    it("infiere telefono con solo dígitos", () => {
        expect(inferirTipoIdentificador("3001234567")).toBe("telefono");
    });

    it("infiere telefono con espacios, guiones y paréntesis", () => {
        expect(inferirTipoIdentificador("+57 (300) 123-4567")).toBe("telefono");
    });

    it("infiere nick para valores alfanuméricos sin @", () => {
        expect(inferirTipoIdentificador("juanito_2026")).toBe("nick");
    });

    it("infiere nick para números demasiado cortos para ser teléfono", () => {
        expect(inferirTipoIdentificador("12345")).toBe("nick");
    });

    it("recorta espacios antes de inferir", () => {
        expect(inferirTipoIdentificador("  +573001234567  ")).toBe("telefono");
    });
});
