/**
 * SPEC-237 (002-PI-mega-cola): tests de componente de ConsolidacionAcciones.
 * Cubre T026: render condicional por rol y validación de devolución sin motivo.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsolidacionAcciones } from "./ConsolidacionAcciones";

const noopAsync = async () => null;

describe("ConsolidacionAcciones", () => {
    it("muestra modo lectura cuando el usuario no puede actuar (ADMIN)", () => {
        render(
            <ConsolidacionAcciones
                puedeActuar={false}
                estadoAprobacion="PENDIENTE_COMITE"
                ejecutando={false}
                onAprobar={noopAsync}
                onDevolver={noopAsync}
            />
        );
        expect(screen.getByTestId("acciones-solo-lectura").textContent).toContain("modo lectura");
        expect(screen.queryByText("Aprobar informe")).toBeNull();
    });

    it("explica el bloqueo cuando el informe ya está APROBADO", () => {
        render(
            <ConsolidacionAcciones
                puedeActuar={false}
                estadoAprobacion="APROBADO"
                ejecutando={false}
                onAprobar={noopAsync}
                onDevolver={noopAsync}
            />
        );
        expect(screen.getByTestId("acciones-solo-lectura").textContent).toContain("APROBADO");
    });

    it("muestra Aprobar y Devolver para un miembro del comité", () => {
        render(
            <ConsolidacionAcciones
                puedeActuar={true}
                estadoAprobacion="PENDIENTE_COMITE"
                ejecutando={false}
                onAprobar={noopAsync}
                onDevolver={noopAsync}
            />
        );
        expect(screen.getByText("Aprobar informe")).toBeTruthy();
        expect(screen.getByText("Devolver")).toBeTruthy();
    });

    it("llama onAprobar al pulsar Aprobar informe", async () => {
        const onAprobar = vi.fn(async () => null);
        render(
            <ConsolidacionAcciones
                puedeActuar={true}
                estadoAprobacion="PENDIENTE_COMITE"
                ejecutando={false}
                onAprobar={onAprobar}
                onDevolver={noopAsync}
            />
        );
        fireEvent.click(screen.getByText("Aprobar informe"));
        await waitFor(() => expect(onAprobar).toHaveBeenCalledTimes(1));
        expect(screen.getByText("Aprobación registrada")).toBeTruthy();
    });

    it("rechaza la devolución sin motivo con mensaje de validación", async () => {
        const onDevolver = vi.fn(async () => null);
        render(
            <ConsolidacionAcciones
                puedeActuar={true}
                estadoAprobacion="PENDIENTE_COMITE"
                ejecutando={false}
                onAprobar={noopAsync}
                onDevolver={onDevolver}
            />
        );
        fireEvent.click(screen.getByText("Devolver"));
        fireEvent.click(screen.getByText("Confirmar devolución"));
        expect(screen.getByRole("alert").textContent).toContain("obligatorio");
        expect(onDevolver).not.toHaveBeenCalled();
    });

    it("envía la devolución con motivo", async () => {
        const onDevolver = vi.fn(async () => null);
        render(
            <ConsolidacionAcciones
                puedeActuar={true}
                estadoAprobacion="PENDIENTE_COMITE"
                ejecutando={false}
                onAprobar={noopAsync}
                onDevolver={onDevolver}
            />
        );
        fireEvent.click(screen.getByText("Devolver"));
        fireEvent.change(screen.getByLabelText("Motivo de la devolución"), {
            target: { value: "Falta evidencia de respaldo" },
        });
        fireEvent.click(screen.getByText("Confirmar devolución"));
        await waitFor(() => expect(onDevolver).toHaveBeenCalledWith("Falta evidencia de respaldo"));
        expect(screen.getByText("Informe devuelto al área de origen")).toBeTruthy();
    });
});
