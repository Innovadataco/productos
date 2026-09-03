/**
 * SPEC-379 (PR A · D5b) — panel `CargaProfesoresExcel`.
 * Smoke test: render inicial, validar sube el archivo y muestra resumen,
 * confirmar dispara `onCompletado` y limpia el estado.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CargaProfesoresExcel } from "./CargaProfesoresExcel";

function fetchOk(json: unknown): Promise<Response> {
    return Promise.resolve({ ok: true, status: 200, json: async () => json } as Response);
}

describe("CargaProfesoresExcel — SPEC-379 (PR A · D5b)", () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it("render: título por defecto y enlace a plantilla", () => {
        render(<CargaProfesoresExcel />);
        expect(screen.getByText("Cargar profesores desde Excel/CSV")).toBeDefined();
        const link = screen.getByRole("link", { name: /Descargar plantilla/i });
        expect(link.getAttribute("href")).toBe("/api/colegio/carga-profesores/plantilla");
    });

    it("acepta un título personalizado (usado desde el wizard)", () => {
        render(<CargaProfesoresExcel titulo="O cargue una lista desde Excel/CSV" />);
        expect(screen.getByText("O cargue una lista desde Excel/CSV")).toBeDefined();
    });

    it("validar: sube el archivo y muestra el resumen que devuelve el endpoint", async () => {
        const fetchMock = vi.fn().mockImplementation(() =>
            fetchOk({
                resumen: { crear: 3, omitidos: 1, errores: 0 },
                filas: [],
                token: "token-de-prueba",
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        render(<CargaProfesoresExcel />);
        const input = screen.getByLabelText(/Archivo de profesores/i) as HTMLInputElement;
        const file = new File(["nombre\nAna"], "profes.csv", { type: "text/csv" });
        fireEvent.change(input, { target: { files: [file] } });

        fireEvent.click(screen.getByRole("button", { name: /^Validar$/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/colegio/carga-profesores/validar",
                expect.objectContaining({ method: "POST" })
            );
        });
        expect(await screen.findByText(/3 listos · 1 omitidos · 0 con problemas/)).toBeDefined();
        // Con token: aparece el botón "Confirmar carga".
        expect(screen.getByRole("button", { name: /Confirmar carga/i })).toBeDefined();
    });

    it("confirmar: llama al endpoint, ejecuta onCompletado y limpia el resumen", async () => {
        const onCompletado = vi.fn();
        const fetchMock = vi.fn().mockImplementation((url: string) => {
            if (url === "/api/colegio/carga-profesores/validar") {
                return fetchOk({
                    resumen: { crear: 2, omitidos: 0, errores: 0 },
                    filas: [],
                    token: "token-x",
                });
            }
            return fetchOk({ ok: true, creados: 2 });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<CargaProfesoresExcel onCompletado={onCompletado} />);
        const input = screen.getByLabelText(/Archivo de profesores/i) as HTMLInputElement;
        fireEvent.change(input, { target: { files: [new File(["x"], "p.csv")] } });
        fireEvent.click(screen.getByRole("button", { name: /^Validar$/i }));
        await screen.findByRole("button", { name: /Confirmar carga/i });

        fireEvent.click(screen.getByRole("button", { name: /Confirmar carga/i }));
        await waitFor(() => expect(onCompletado).toHaveBeenCalledTimes(1));
        // Resumen desaparece tras confirmar.
        expect(screen.queryByText(/2 listos/)).toBeNull();
    });
});
