/**
 * SPEC-607 · alta de hijos SIN documento (diseño final, módulo 5 del mockup:
 * «alta de hijos sin documento: nombres y apellidos obligatorios; edad, sexo y
 * cuentas opcionales»). El modelo ya no tiene las columnas (SPEC-589 las
 * eliminó); este candado fija el contrato del FORMULARIO inline (SPEC-601):
 *
 *  - no existe campo de tipo ni número de documento en el DOM;
 *  - el alta sale con solo nombres + apellidos (201 del servidor);
 *  - la validación NO exige documento: ni tipo ni número viajan en el payload.
 *
 * Muere por mutación: devolver un input de documento al formulario o exigirlo
 * antes del POST → rojo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { FormularioAltaHijo } from "./FormularioAltaHijo";

const fetchMock = vi.fn();
const onRegistrado = vi.fn();

beforeEach(() => {
    fetchMock.mockReset();
    onRegistrado.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ hijoId: "h1" }) } as Response);
});

const PLATAFORMAS = [{ value: "p1", label: "Roblox" }];

function renderForm() {
    return render(<FormularioAltaHijo opcionesPlataforma={PLATAFORMAS} onRegistrado={onRegistrado} />);
}

describe("FormularioAltaHijo (SPEC-607 · hijos sin documento)", () => {
    it("el formulario NO pide tipo ni número de documento; conserva nombres, apellidos, edad, sexo y cuentas", () => {
        renderForm();

        expect(screen.getByLabelText("Nombres")).toBeDefined();
        expect(screen.getByLabelText("Apellidos")).toBeDefined();
        expect(screen.getByLabelText("Edad")).toBeDefined();
        expect(screen.getByLabelText("Sexo")).toBeDefined();
        expect(screen.getByLabelText("Cuenta")).toBeDefined();

        expect(screen.queryByLabelText(/Tipo de documento/i)).toBeNull();
        expect(screen.queryByLabelText(/Número de documento/i)).toBeNull();
        expect(screen.queryByText(/documento/i)).toBeNull();
    });

    it("alta OK con SOLO nombres y apellidos: POST sin documento ni año, y avisa al padre", async () => {
        renderForm();

        fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Laura Sofía" } });
        fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Gómez Ruiz" } });
        fireEvent.submit(screen.getByTestId("form-hijo"));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(url).toBe("/api/padre/hijos");
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({ nombre: "Laura Sofía", apellidos: "Gómez Ruiz" });
        expect(body).not.toHaveProperty("documentoTipo");
        expect(body).not.toHaveProperty("documentoNumero");
        expect(body).not.toHaveProperty("anioNacimiento");
        expect(body).not.toHaveProperty("sexo");

        await waitFor(() => expect(onRegistrado).toHaveBeenCalledOnce());
    });

    it("la validación NO exige documento: sin nombre frena, con nombre y apellidos pasa", async () => {
        renderForm();

        // Sin nombre: error local y el POST nunca sale.
        fireEvent.submit(screen.getByTestId("form-hijo"));
        expect(screen.getByTestId("form-alta-error").textContent).toContain("nombre");
        expect(fetchMock).not.toHaveBeenCalled();

        // Solo con lo obligatorio: sale el alta.
        fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Nicolás" } });
        fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Gómez" } });
        fireEvent.submit(screen.getByTestId("form-hijo"));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    });
});
