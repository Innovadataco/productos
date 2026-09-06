import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IdentificadorBusquedaClient } from "./IdentificadorBusquedaClient";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
    default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

const expedienteBase = {
    identificadorReportado: "@nick_ejemplo",
    estado: "ACTIVO" as const,
    scoreGravedadActual: "VERDE" as const,
    ultimoEventoEn: null,
};

describe("IdentificadorBusquedaClient (SPEC-233)", () => {
    beforeEach(() => {
        pushMock.mockClear();
    });

    it("muestra estado vacío con CTA a reportar cuando no hay expedientes", () => {
        render(<IdentificadorBusquedaClient identificador="@sin_expedientes" expedientes={[]} />);

        expect(screen.getByText("No tienes expedientes sobre esta cuenta")).toBeDefined();
        const cta = screen.getByRole("link", { name: /Reportar una situación/i });
        expect(cta.getAttribute("href")).toBe("/dashboard/padre/reportar");
    });

    it("lista los expedientes en el orden recibido con link al detalle", () => {
        render(
            <IdentificadorBusquedaClient
                identificador="@nick_ejemplo"
                expedientes={[
                    { ...expedienteBase, id: "exp-nuevo", fechaApertura: new Date("2026-08-20T10:00:00Z"), numEventos: 2 },
                    { ...expedienteBase, id: "exp-viejo", estado: "CERRADO", fechaApertura: new Date("2026-08-01T10:00:00Z"), numEventos: 5 },
                ]}
            />
        );

        const links = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
        expect(links).toEqual([
            "/dashboard/padre/expedientes/exp-nuevo",
            "/dashboard/padre/expedientes/exp-viejo",
        ]);
        expect(screen.getByText("Activo · 2 eventos")).toBeDefined();
        expect(screen.getByText("Cerrado · 5 eventos")).toBeDefined();
    });

    it("navega a la misma ruta con el identificador codificado al buscar", () => {
        render(<IdentificadorBusquedaClient identificador="@nick_ejemplo" expedientes={[]} />);

        const input = screen.getByLabelText("Buscar por cuenta");
        fireEvent.change(input, { target: { value: "@nick con espacios/#" } });
        fireEvent.submit(input.closest("form") as HTMLFormElement);

        expect(pushMock).toHaveBeenCalledWith(
            `/dashboard/padre/identificador/${encodeURIComponent("@nick con espacios/#")}`
        );
    });

    it("no navega cuando la búsqueda está vacía", () => {
        render(<IdentificadorBusquedaClient identificador="@nick_ejemplo" expedientes={[]} />);

        const input = screen.getByLabelText("Buscar por cuenta");
        fireEvent.change(input, { target: { value: "   " } });
        fireEvent.submit(input.closest("form") as HTMLFormElement);

        expect(pushMock).not.toHaveBeenCalled();
    });
});
