import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistroColegioForm } from "./RegistroColegioForm";

describe("RegistroColegioForm", () => {
    it("renderiza los campos de email, colegio y rector", () => {
        render(<RegistroColegioForm onSolicitarCodigo={vi.fn()} />);

        expect(screen.getByLabelText("Correo electrónico del rector")).toBeTruthy();
        expect(screen.getByLabelText("Nombre del colegio")).toBeTruthy();
        expect(screen.getByLabelText("Nombre del rector")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Enviar código de verificación" })).toBeTruthy();
    });

    it("muestra error si faltan campos", async () => {
        render(<RegistroColegioForm onSolicitarCodigo={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Enviar código de verificación" }));

        await waitFor(() => {
            expect(screen.getByText("Completa todos los campos.")).toBeTruthy();
        });
    });

    it("envía los datos cuando el formulario es válido", async () => {
        const onSolicitarCodigo = vi.fn().mockResolvedValue(undefined);
        render(<RegistroColegioForm onSolicitarCodigo={onSolicitarCodigo} />);

        fireEvent.change(screen.getByLabelText("Correo electrónico del rector"), {
            target: { value: "rector@colegio.edu" },
        });
        fireEvent.change(screen.getByLabelText("Nombre del colegio"), {
            target: { value: "Colegio Ejemplo" },
        });
        // SPEC-320 (§2.2-bis): NIT obligatorio.
        fireEvent.change(screen.getByLabelText("NIT del colegio"), {
            target: { value: "900123456-7" },
        });
        fireEvent.change(screen.getByLabelText("Nombre del rector"), {
            target: { value: "Carlos Ejemplo" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Enviar código de verificación" }));

        await waitFor(() => {
            expect(onSolicitarCodigo).toHaveBeenCalledWith({
                email: "rector@colegio.edu",
                nombreColegio: "Colegio Ejemplo",
                nombreRector: "Carlos Ejemplo",
                nit: "900123456-7",
            });
        });
    });
});
