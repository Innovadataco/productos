import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IdentificadorExpedientesAnonimos } from "./IdentificadorExpedientesAnonimos";
import type { ExpedienteAnonimoItem } from "./IdentificadorExpedientesAnonimos";

const filaBase: ExpedienteAnonimoItem = {
    estado: "ACTIVO",
    scoreGravedadActual: "AMARILLO",
    fechaApertura: new Date("2026-08-10T10:00:00Z"),
    fechaCierre: null,
    numEventos: 4,
    plataformaId: "whatsapp",
};

describe("IdentificadorExpedientesAnonimos (SPEC-233)", () => {
    it("usa lenguaje descriptivo/estadístico con el conteo de expedientes", () => {
        render(<IdentificadorExpedientesAnonimos expedientes={[filaBase, filaBase, filaBase, filaBase, filaBase]} />);

        expect(screen.getByText("5 expedientes registrados sobre este identificador")).toBeDefined();
    });

    it("renderiza nulos como '—' (plataforma y cierre)", () => {
        render(<IdentificadorExpedientesAnonimos expedientes={[{ ...filaBase, plataformaId: null }]} />);

        const guiones = screen.getAllByText("—");
        expect(guiones.length).toBe(2);
    });

    it("el HTML no contiene identidad del padre, correos, teléfonos ni textos de eventos", () => {
        const { container } = render(
            <IdentificadorExpedientesAnonimos
                expedientes={[
                    filaBase,
                    { ...filaBase, estado: "CERRADO", fechaCierre: new Date("2026-08-15T10:00:00Z") },
                ]}
            />
        );

        const html = container.innerHTML;
        expect(html).not.toMatch(/padreUsuarioId/i);
        expect(html).not.toMatch(/[\w.-]+@[\w.-]+\.\w+/); // sin correos
        expect(html).not.toMatch(/\+57\d{10}/); // sin teléfonos
        expect(html).not.toMatch(/texto/i);
        expect(html).not.toMatch(/categoria/i);
    });

    it("muestra etiquetas en criollo para todos los estados", () => {
        render(
            <IdentificadorExpedientesAnonimos
                expedientes={[
                    { ...filaBase, estado: "ESCALADO" },
                    { ...filaBase, estado: "PENDIENTE_COMITE" },
                ]}
            />
        );

        expect(screen.getByText("Escalado")).toBeDefined();
        expect(screen.getByText("Pendiente comité")).toBeDefined();
    });
});
