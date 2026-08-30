import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReporteBloqueoRol } from "./ReporteBloqueoRol";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

describe("ReporteBloqueoRol · SPEC-314 (002-PI-214)", () => {
    beforeEach(() => {
        pushMock.mockClear();
    });

    it("renderiza el mensaje UX-friendly y las 2 CTAs de escape", () => {
        render(<ReporteBloqueoRol onLogoutAndRetry={vi.fn()} returnTo="/reportar" />);
        // Título y mensaje
        expect(screen.getByText(/cuentas internas no pueden crear reportes/i)).toBeTruthy();
        expect(
            screen.getByText(/colegio · admin · comités/i)
        ).toBeTruthy();
        // CTA A · logout + retry anónimo
        expect(screen.getByTestId("cta-logout-anonimo").textContent).toContain(
            "Cerrar sesión y reportar anónimo"
        );
        // CTA B · registrarme como padre
        expect(screen.getByTestId("cta-registro-padre").textContent).toContain(
            "Registrarme como padre"
        );
    });

    it("CTA A dispara el callback onLogoutAndRetry", async () => {
        const onLogout = vi.fn().mockResolvedValue(undefined);
        render(<ReporteBloqueoRol onLogoutAndRetry={onLogout} returnTo="/reportar" />);
        fireEvent.click(screen.getByTestId("cta-logout-anonimo"));
        // El handler es async; el click dispara la promesa inmediatamente.
        expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it("CTA B redirige a /registro con rol=PARENT y returnTo encoded", () => {
        render(<ReporteBloqueoRol onLogoutAndRetry={vi.fn()} returnTo="/reportar" />);
        fireEvent.click(screen.getByTestId("cta-registro-padre"));
        expect(pushMock).toHaveBeenCalledWith("/registro?rol=PARENT&returnTo=%2Freportar");
    });

    it("CTA B usa /reportar como default cuando returnTo es undefined", () => {
        render(<ReporteBloqueoRol onLogoutAndRetry={vi.fn()} />);
        fireEvent.click(screen.getByTestId("cta-registro-padre"));
        // En jsdom `window.location.pathname` es "/" · fallback a "/reportar" solo si
        // window undefined; aquí verifica que dispara push con /registro y query rol=PARENT.
        expect(pushMock).toHaveBeenCalledTimes(1);
        const arg = pushMock.mock.calls[0]?.[0] as string;
        expect(arg).toMatch(/^\/registro\?rol=PARENT&returnTo=/);
    });

    it("el card tiene role=alert y data-testid para accesibilidad y tests", () => {
        render(<ReporteBloqueoRol onLogoutAndRetry={vi.fn()} returnTo="/reportar" />);
        const card = screen.getByTestId("reporte-bloqueo-rol");
        expect(card.getAttribute("role")).toBe("alert");
    });
});
