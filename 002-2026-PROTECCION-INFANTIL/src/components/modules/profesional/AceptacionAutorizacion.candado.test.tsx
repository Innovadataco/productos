/**
 * CANDADO · SPEC-686 (I-420) · La pantalla de aceptación no deja aceptar lo que no se leyó,
 * y DICE por qué el botón está inerte (FORMA de Diseño §1).
 *
 * Reglas duras: botón «Acepto la autorización» inerte hasta bajar al final del texto Y marcar
 * la casilla; la razón dicha bajo el botón; la declaración es el texto legal VERBATIM.
 * Muere por mutación: si el botón nace habilitado, o se pierde la razón, o cambia la declaración.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AceptacionAutorizacion } from "./AceptacionAutorizacion";

const DECLARACION =
    "Declaro que la información y los documentos que cargo son verídicos, y autorizo a " +
    "INNOVADATACO S.A.S. a verificar mi identidad, mi habilitación profesional y mis " +
    "antecedentes, y a tratar mis datos en los términos de esta autorización.";

/** Igual que el candado del consentimiento del padre: el observer dispara «llegó al final». */
function mockIntersectionObserverIntersecta() {
    vi.stubGlobal(
        "IntersectionObserver",
        vi.fn((cb: IntersectionObserverCallback) => ({
            observe: () =>
                cb(
                    [{ isIntersecting: true, target: document.createElement("div") } as unknown as IntersectionObserverEntry],
                    {} as IntersectionObserver,
                ),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
        })),
    );
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

const props = { version: "v0.1", documentoContenido: "# Autorización\n\nTexto de prueba.", redirectUrl: "/x" };

describe("SPEC-686 · pantalla de aceptación: no aceptar lo que no se leyó, y decir por qué", () => {
    it("nace inerte, dice por qué, y muestra la declaración VERBATIM", () => {
        // Sin observer (jsdom): el scroll no se completa → el botón queda inerte.
        vi.stubGlobal("IntersectionObserver", undefined);
        render(<AceptacionAutorizacion {...props} />);
        const boton = screen.getByTestId("btn-aceptar-autorizacion") as HTMLButtonElement;
        expect(boton.disabled, "nace inerte").toBe(true);
        expect(screen.getByText(/Baje hasta el final del texto y marque la casilla para aceptar/i)).toBeTruthy();
        expect(screen.getByText(DECLARACION), "la declaración es verbatim del texto legal").toBeTruthy();
    });

    it("marcar la casilla SIN leer no alcanza — sigue inerte", () => {
        vi.stubGlobal("IntersectionObserver", undefined);
        render(<AceptacionAutorizacion {...props} />);
        fireEvent.click(screen.getByTestId("check-declaracion"));
        expect((screen.getByTestId("btn-aceptar-autorizacion") as HTMLButtonElement).disabled).toBe(true);
    });

    it("leer hasta el final Y marcar la casilla habilita; la razón desaparece", async () => {
        mockIntersectionObserverIntersecta();
        render(<AceptacionAutorizacion {...props} />);
        fireEvent.click(screen.getByTestId("check-declaracion"));
        await waitFor(() =>
            expect((screen.getByTestId("btn-aceptar-autorizacion") as HTMLButtonElement).disabled).toBe(false),
        );
        expect(screen.queryByText(/Baje hasta el final del texto y marque la casilla para aceptar/i)).toBeNull();
    });
});
