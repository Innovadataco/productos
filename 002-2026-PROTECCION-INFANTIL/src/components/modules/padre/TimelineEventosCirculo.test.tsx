/**
 * SPEC-306 (A-50): tests de renderizado de TimelineEventosCirculo.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelineEventosCirculo } from "./TimelineEventosCirculo";
import type { TimelineEvento } from "@/lib/padre/timeline-circulo";

function crearEvento(overrides: Partial<TimelineEvento> = {}): TimelineEvento {
    return {
        id: `reporte-${Math.random().toString(36).slice(2)}`,
        tipo: "REPORTE",
        fecha: new Date().toISOString(),
        severity: "ROJO",
        categoria: "SOLICITUD_MATERIAL",
        titulo: "Reporte recibido · WhatsApp",
        descripcion: "Identificador reportado: +573001111111 (clasificado).",
        expedienteId: null,
        contactoEtiqueta: "Hijo",
        identificador: "+573001111111",
        ...overrides,
    };
}

describe("TimelineEventosCirculo (SPEC-306)", () => {
    it("renderiza lista ordenada de eventos", () => {
        const eventos = [
            crearEvento({ id: "evento-1", titulo: "Evento primero", severity: "ROJO" }),
            crearEvento({ id: "evento-2", titulo: "Evento segundo", severity: "AMARILLO" }),
        ];

        render(<TimelineEventosCirculo eventos={eventos} />);

        expect(screen.getByText("Evento primero")).toBeDefined();
        expect(screen.getByText("Evento segundo")).toBeDefined();
    });

    it("muestra estado vacío cuando no hay eventos", () => {
        render(<TimelineEventosCirculo eventos={[]} />);

        expect(screen.getByText(/No hay eventos registrados/i)).toBeDefined();
    });

    it("el botón 'abrir expediente' navega a la ruta correcta", () => {
        const eventos = [
            crearEvento({
                id: "evento-1",
                expedienteId: "exp-abc-123",
                titulo: "Evento con expediente",
            }),
        ];

        render(<TimelineEventosCirculo eventos={eventos} />);

        const link = screen.getByRole("link", { name: /abrir expediente/i });
        expect(link.getAttribute("href")).toBe("/dashboard/padre/expedientes/exp-abc-123");
    });
});
