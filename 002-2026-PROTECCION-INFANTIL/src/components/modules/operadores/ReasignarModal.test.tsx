/**
 * SPEC-193 Fase 4 — Tests unitarios del modal de reasignación de reportes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ReasignarModal } from "./ReasignarModal";

const operadoresMock = [
    { id: "op-actual", email: "actual@example.com", nombre: "Actual", rol: "OPERADOR", estado: "activo" },
    { id: "op-destino", email: "destino@example.com", nombre: "Destino", rol: "OPERADOR", estado: "activo" },
    { id: "op-inactivo", email: "inactivo@example.com", nombre: "Inactivo", rol: "OPERADOR", estado: "inactivo" },
];

function mockFetch(url: string | Request, init?: RequestInit) {
    const path = String(url);
    if (path === "/api/admin/operadores") {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ operadores: operadoresMock }),
        } as Response);
    }
    if (path === "/api/admin/operadores/reasignar" && init?.method === "PATCH") {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ id: "reporte-1", operadorId: "op-destino", estado: "REVISION_MANUAL" }),
        } as Response);
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
}

describe("ReasignarModal", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(mockFetch);
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function renderModal(props = {}) {
        return render(
            <ReasignarModal
                reporteId="reporte-1"
                operadorActualId="op-actual"
                operadorActualNombre="Actual"
                isOpen={true}
                onClose={vi.fn()}
                onReasignado={vi.fn()}
                {...props}
            />
        );
    }

    it("renderiza la lista de operadores activos excepto el actual", async () => {
        renderModal();
        const select = await screen.findByLabelText("Operador destino");
        const options = within(select).getAllByRole("option");
        const values = options.map((o) => (o as HTMLOptionElement).value);
        expect(values).toContain("op-destino");
        expect(values).not.toContain("op-actual");
        expect(values).not.toContain("op-inactivo");
    });

    it("rechaza un motivo corto", async () => {
        renderModal();
        await screen.findByLabelText("Operador destino");

        fireEvent.change(screen.getByLabelText("Operador destino"), { target: { value: "op-destino" } });
        fireEvent.change(screen.getByLabelText("Motivo de la reasignación"), { target: { value: "corto" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));

        await waitFor(() => expect(screen.getByText(/El motivo debe tener entre 20 y 500 caracteres/)).toBeTruthy());
        expect(fetchMock).not.toHaveBeenCalledWith(
            "/api/admin/operadores/reasignar",
            expect.objectContaining({ method: "PATCH" })
        );
    });

    it("no permite seleccionar el operador actual como destino", async () => {
        renderModal();
        const select = await screen.findByLabelText("Operador destino");
        const options = within(select).getAllByRole("option");
        const values = options.map((o) => (o as HTMLOptionElement).value);
        expect(values).not.toContain("op-actual");
    });

    it("llama al endpoint y ejecuta onReasignado al confirmar", async () => {
        const onReasignado = vi.fn();
        const onClose = vi.fn();
        renderModal({ onReasignado, onClose });

        await screen.findByLabelText("Operador destino");
        fireEvent.change(screen.getByLabelText("Operador destino"), { target: { value: "op-destino" } });
        fireEvent.change(screen.getByLabelText("Motivo de la reasignación"), {
            target: { value: "Se reasigna por carga de trabajo excesiva en el operador actual." },
        });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/admin/operadores/reasignar",
                expect.objectContaining({
                    method: "PATCH",
                    body: JSON.stringify({
                        reporteId: "reporte-1",
                        operadorDestinoId: "op-destino",
                        motivo: "Se reasigna por carga de trabajo excesiva en el operador actual.",
                    }),
                })
            )
        );

        await waitFor(() => expect(onReasignado).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
});
