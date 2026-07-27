import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingFooter } from "./LandingFooter";

describe("LandingFooter (spec 102)", () => {
    afterEach(() => {
        delete process.env.APP_BUILD_SHA;
    });

    it("muestra copyright, versión y enlaces legales", () => {
        render(<LandingFooter />);
        expect(
            screen.getByText("© 2026 Innovadataco. Todos los derechos reservados. · Versión 1.0.0")
        ).toBeTruthy();
        const privacidad = screen.getByRole("link", { name: "Privacidad" });
        const terminos = screen.getByRole("link", { name: "Términos" });
        expect(privacidad.getAttribute("href")).toBe("/privacidad");
        expect(terminos.getAttribute("href")).toBe("/terminos");
    });

    it("nunca muestra el SHA del build en el pie público", () => {
        process.env.APP_BUILD_SHA = "testsha123";
        render(<LandingFooter />);
        expect(screen.queryByText(/testsha123/)).toBeNull();
        expect(screen.getByText(/Versión 1\.0\.0/)).toBeTruthy();
    });
});
