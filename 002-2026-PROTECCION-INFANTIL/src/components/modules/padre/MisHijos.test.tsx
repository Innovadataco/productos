/**
 * SPEC-325 (002-PI-225): UI "A quién protejo" — render, alta y desvinculación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MisHijos } from "./MisHijos";

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

function jsonRes(body: unknown, ok = true) {
    return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

describe("MisHijos", () => {
    it("muestra el vacío cuando no hay hijos", async () => {
        fetchMock.mockReturnValueOnce(jsonRes([]));
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("mis-hijos-vacio")).toBeDefined());
        // sección distinguible con el título de protejo
        expect(screen.getByText("A quién protejo")).toBeDefined();
    });

    it("lista un hijo con su identificador", async () => {
        fetchMock.mockReturnValueOnce(
            jsonRes([
                {
                    id: "h1",
                    nombre: "Juan",
                    apellidos: "Pérez",
                    documentoTipo: "TI",
                    documentoNumero: "1001",
                    anioNacimiento: 2015,
                    sexo: "M",
                    identificadores: [{ id: "i1", valor: "robloxjuan", tipo: null, plataforma: null }],
                },
            ])
        );
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        expect(screen.getByText("Juan Pérez")).toBeDefined();
        expect(screen.getByText(/robloxjuan/)).toBeDefined();
    });

    it("registrar hace POST y recarga", async () => {
        fetchMock
            .mockReturnValueOnce(jsonRes([])) // carga inicial
            .mockReturnValueOnce(jsonRes({ hijoId: "h9", vinculadoAExistente: false }, true)) // POST
            .mockReturnValueOnce(jsonRes([])); // recarga
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("mis-hijos-vacio")).toBeDefined());

        fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Ana" } });
        fireEvent.change(screen.getByLabelText("Número de documento"), { target: { value: "3003" } });
        fireEvent.submit(screen.getByTestId("form-hijo"));

        await waitFor(() => {
            const postCall = fetchMock.mock.calls.find((c) => c[1]?.method === "POST");
            expect(postCall).toBeDefined();
            expect(postCall![0]).toBe("/api/padre/hijos");
            expect(String(postCall![1].body)).toContain("Ana");
        });
    });

    it("desvincular identificador hace DELETE a la ruta correcta", async () => {
        fetchMock
            .mockReturnValueOnce(
                jsonRes([
                    {
                        id: "h1",
                        nombre: "Leo",
                        apellidos: "",
                        documentoTipo: "TI",
                        documentoNumero: "4004",
                        anioNacimiento: null,
                        sexo: null,
                        identificadores: [{ id: "ix", valor: "leogamer", tipo: null, plataforma: null }],
                    },
                ])
            )
            .mockReturnValueOnce(jsonRes({ ok: true })) // DELETE
            .mockReturnValueOnce(jsonRes([])); // recarga
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("lista-hijos")).toBeDefined());
        fireEvent.click(screen.getByLabelText("Quitar leogamer"));
        await waitFor(() => {
            const del = fetchMock.mock.calls.find((c) => c[1]?.method === "DELETE");
            expect(del).toBeDefined();
            expect(del![0]).toBe("/api/padre/hijos/identificadores/ix");
        });
    });
});
