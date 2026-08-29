import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogContextoModal } from "./LogContextoModal";

describe("SPEC-209: LogContextoModal contraste", () => {
    it("renderiza mensaje humano con fondo oscuro y texto claro", () => {
        render(<LogContextoModal isOpen={true} onClose={() => {}} contextoJson={{ signal: "SIGTERM" }} />);

        const bloque = screen.getByText("Worker recibió señal de cierre normal").closest("div");
        expect(bloque).toBeTruthy();
        expect(bloque?.className).toContain("bg-tinta/90");
        expect(bloque?.className).toContain("dark:bg-tinta/95");

        const texto = screen.getByText("Worker recibió señal de cierre normal");
        expect(texto.className).toContain("text-fondo");
        expect(texto.className).toContain("font-medium");
    });

});
