import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpamResolucionModal } from "./SpamResolucionModal";

vi.mock("@/components/modules/AdminReporteDetalle", () => ({
    AdminReporteDetalle: ({ reporteId }: { reporteId: string }) => <div data-testid="detalle-mock">Detalle {reporteId}</div>,
}));

describe("SpamResolucionModal", () => {
    it("renderiza detalle, select de categoría y botones de resolución", () => {
        render(
            <SpamResolucionModal
                reporteId="r1"
                categoria="OTRO"
                motivo=""
                resolviendo={false}
                onClose={vi.fn()}
                onCategoriaChange={vi.fn()}
                onMotivoChange={vi.fn()}
                onResolve={vi.fn()}
                onRefresh={vi.fn()}
            />
        );

        expect(screen.getByText("Revisar posible spam")).toBeTruthy();
        expect(screen.getByTestId("detalle-mock").textContent).toContain("Detalle r1");
        expect(screen.getByRole("button", { name: "Procesar como acoso" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Marcar como válido" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Confirmar spam" })).toBeTruthy();
    });

    it("cambia categoría y motivo", () => {
        const onCategoriaChange = vi.fn();
        const onMotivoChange = vi.fn();

        render(
            <SpamResolucionModal
                reporteId="r1"
                categoria="OTRO"
                motivo=""
                resolviendo={false}
                onClose={vi.fn()}
                onCategoriaChange={onCategoriaChange}
                onMotivoChange={onMotivoChange}
                onResolve={vi.fn()}
                onRefresh={vi.fn()}
            />
        );

        fireEvent.change(screen.getByRole("combobox"), { target: { value: "DOXING" } });
        expect(onCategoriaChange).toHaveBeenCalledWith("DOXING");

        fireEvent.change(screen.getByPlaceholderText("Motivo de la resolución (opcional)"), { target: { value: "spam claro" } });
        expect(onMotivoChange).toHaveBeenCalledWith("spam claro");
    });

    it("dispara cada decisión de resolución", () => {
        const onResolve = vi.fn();
        render(
            <SpamResolucionModal
                reporteId="r1"
                categoria="OTRO"
                motivo=""
                resolviendo={false}
                onClose={vi.fn()}
                onCategoriaChange={vi.fn()}
                onMotivoChange={vi.fn()}
                onResolve={onResolve}
                onRefresh={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Procesar como acoso" }));
        expect(onResolve).toHaveBeenCalledWith("procesar_como_acoso");

        fireEvent.click(screen.getByRole("button", { name: "Marcar como válido" }));
        expect(onResolve).toHaveBeenCalledWith("corregir");

        fireEvent.click(screen.getByRole("button", { name: "Confirmar spam" }));
        expect(onResolve).toHaveBeenCalledWith("es_spam");
    });

    it("deshabilita botones mientras resuelve", () => {
        render(
            <SpamResolucionModal
                reporteId="r1"
                categoria="OTRO"
                motivo=""
                resolviendo
                onClose={vi.fn()}
                onCategoriaChange={vi.fn()}
                onMotivoChange={vi.fn()}
                onResolve={vi.fn()}
                onRefresh={vi.fn()}
            />
        );

        const botones = screen.getAllByRole("button", { name: "Resolviendo..." }) as HTMLButtonElement[];
        expect(botones.length).toBe(3);
        botones.forEach((b) => expect(b.disabled).toBe(true));
    });
});
