/**
 * SPEC-306 (A-50): tests de renderizado de TimelineEventoItem.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelineEventoItem } from "./TimelineEventoItem";

const eventoBase = {
    id: "reporte-1",
    tipo: "REPORTE" as const,
    fecha: new Date().toISOString(),
    severity: "ROJO" as const,
    categoria: "SOLICITUD_MATERIAL",
    titulo: "Reporte recibido · WhatsApp",
    descripcion: "Identificador reportado: +573001111111 (clasificado).",
    expedienteId: "exp-123",
    contactoEtiqueta: "Hijo",
    identificador: "+573001111111",
};

describe("TimelineEventoItem (SPEC-306)", () => {
    it("renderiza evento ROJO con fecha, categoría y botón 'abrir expediente'", () => {
        render(<TimelineEventoItem {...eventoBase} />);

        expect(screen.getByText(eventoBase.titulo)).toBeDefined();
        expect(screen.getByText(eventoBase.descripcion)).toBeDefined();
        expect(screen.getByText("Crítico")).toBeDefined();
        expect(screen.getByText(eventoBase.categoria)).toBeDefined();
        expect(screen.getByText("Abrir expediente")).toBeDefined();

        const link = screen.getByRole("link", { name: /abrir expediente/i });
        expect(link.getAttribute("href")).toBe(`/dashboard/padre/expedientes/${eventoBase.expedienteId}`);
    });

    it("no muestra el botón cuando expedienteId es null", () => {
        render(<TimelineEventoItem {...eventoBase} expedienteId={null} />);

        expect(screen.queryByText("Abrir expediente")).toBeNull();
    });

    it("renderiza evento VERDE sin categoría", () => {
        render(
            <TimelineEventoItem
                {...eventoBase}
                severity="VERDE"
                categoria={null}
                titulo="Reporte recibido"
                expedienteId={null}
            />
        );

        expect(screen.getByText("Bajo")).toBeDefined();
        expect(screen.queryByText(eventoBase.categoria)).toBeNull();
    });
});
