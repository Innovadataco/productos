/**
 * SPEC-159 (T005, FR-004/FR-005): tests de BitacoraCaso — lista las notas con
 * autor y fecha, publica por el endpoint (texto recortado) y no ofrece verbos
 * de edición ni borrado (inmutabilidad).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BitacoraCaso } from "./BitacoraCaso";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh }),
}));

const NOTAS = [
    { id: "n1", texto: "Llamé a la acudiente", autor: "Admin Colegio", creadoEn: "2026-08-09T10:00:00.000Z" },
    { id: "n2", texto: "Citada para el jueves", autor: "Admin Colegio", creadoEn: "2026-08-09T11:00:00.000Z" },
];

describe("BitacoraCaso", () => {
    beforeEach(() => {
        vi.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            json: async () => ({ nota: { id: "n3", creadoEn: "2026-08-09T12:00:00.000Z" } }),
        } as Response);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        refresh.mockClear();
    });

    it("lista las notas asc y NO hay verbos de edición/borrado", () => {
        render(<BitacoraCaso alertaId="a1" notas={NOTAS} />);
        expect(screen.getByText("Llamé a la acudiente")).toBeDefined();
        expect(screen.getByText("Citada para el jueves")).toBeDefined();
        expect(screen.queryByRole("button", { name: /editar/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /borrar|eliminar/i })).toBeNull();
    });

    it("publica la nota recortada por POST y refresca", async () => {
        render(<BitacoraCaso alertaId="a1" notas={[]} />);

        const boton = screen.getByRole("button", { name: "Registrar en la bitácora" });
        expect((boton as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(screen.getByLabelText("Nueva nota"), { target: { value: "  Hablé con el profesor  " } });
        fireEvent.click(boton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/colegio/alertas/a1/notas",
                expect.objectContaining({ method: "POST", body: JSON.stringify({ texto: "Hablé con el profesor" }) })
            );
        });
        await waitFor(() => expect(refresh).toHaveBeenCalled());
    });

    it("muestra el error del servidor sin refrescar", async () => {
        vi.spyOn(global, "fetch").mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: "La nota no puede superar 1000 caracteres" } }),
        } as Response);

        render(<BitacoraCaso alertaId="a1" notas={[]} />);
        fireEvent.change(screen.getByLabelText("Nueva nota"), { target: { value: "Nota" } });
        fireEvent.click(screen.getByRole("button", { name: "Registrar en la bitácora" }));

        await waitFor(() => {
            expect(screen.getByText("La nota no puede superar 1000 caracteres")).toBeDefined();
        });
        expect(refresh).not.toHaveBeenCalled();
    });
});
