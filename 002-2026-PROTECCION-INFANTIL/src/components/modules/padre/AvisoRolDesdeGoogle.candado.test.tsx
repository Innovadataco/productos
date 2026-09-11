/**
 * SPEC-631 §3 · CANDADO — el aviso «entré con Google eligiendo profesional pero mi correo ya es
 * familia» aparece SOLO con la marca `?aviso=cuenta-familia`, trae el copy aprobado (voz tú) y es
 * DESCARTABLE. Gateado exacto: en un aterrizaje normal del padre no aparece. Unit (jsdom), sin BD.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AvisoRolDesdeGoogle } from "./AvisoRolDesdeGoogle";

const { paramsRef } = vi.hoisted(() => ({ paramsRef: { current: new URLSearchParams() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => paramsRef.current }));

describe("SPEC-631 §3 · AvisoRolDesdeGoogle", () => {
    beforeEach(() => {
        cleanup();
    });

    it("con ?aviso=cuenta-familia muestra el aviso (copy aprobado, voz tú) y se puede DESCARTAR", () => {
        paramsRef.current = new URLSearchParams("aviso=cuenta-familia");
        render(<AvisoRolDesdeGoogle />);
        expect(screen.getByText(/este correo ya tiene una cuenta de familia/i)).toBeTruthy();
        expect(screen.getByText(/registro aparte, con verificación/i)).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Descartar aviso"));
        expect(screen.queryByText(/este correo ya tiene una cuenta de familia/i), "descartado → no vuelve").toBeNull();
    });

    it("sin la marca NO muestra nada (aterrizaje normal del padre)", () => {
        paramsRef.current = new URLSearchParams();
        const { container } = render(<AvisoRolDesdeGoogle />);
        expect(container.firstChild).toBeNull();
    });

    it("con otra marca cualquiera NO muestra nada (gateado EXACTO, no por presencia de `aviso`)", () => {
        paramsRef.current = new URLSearchParams("aviso=otra-cosa");
        const { container } = render(<AvisoRolDesdeGoogle />);
        expect(container.firstChild).toBeNull();
    });
});
