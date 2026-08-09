/**
 * SPEC-147 (T006, FR-005) — FormAgregarEstudiante: alta con nombre + apellidos
 * obligatorios y acudiente opcional, contra el endpoint existente.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormAgregarEstudiante } from "./FormAgregarEstudiante";

afterEach(() => {
    vi.unstubAllGlobals();
});

function mockFetchOk() {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ alumno: { id: "nuevo" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("FormAgregarEstudiante", () => {
    it("sin nombre/apellidos válidos no envía y muestra el error", async () => {
        const fetchMock = mockFetchOk();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("alta solo con nombre + apellidos: POST sin acudientes y onCreado", async () => {
        const fetchMock = mockFetchOk();
        const onCreado = vi.fn();
        const onClose = vi.fn();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={onClose} onCreado={onCreado} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "María" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Gómez Torres" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(url).toBe("/api/colegio/cursos/c1/alumnos");
        expect(JSON.parse(init.body)).toEqual({ nombre: "María", apellidos: "Gómez Torres" });
        await waitFor(() => expect(onCreado).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("alta con acudiente: el body lleva acudientes con orden 1 y solo los datos diligenciados", async () => {
        const fetchMock = mockFetchOk();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "Juan" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Ramírez" } });
        fireEvent.click(screen.getByRole("button", { name: "+ Agregar acudiente (opcional)" }));
        fireEvent.change(screen.getByLabelText("Nombre del acudiente"), { target: { value: "Marta Torres" } });
        fireEvent.change(screen.getByLabelText("Relación del acudiente"), { target: { value: "madre" } });
        fireEvent.change(screen.getByLabelText("Teléfono del acudiente"), { target: { value: "+573001112233" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
        expect(body.acudientes).toEqual([
            { orden: 1, nombre: "Marta Torres", relacion: "madre", telefono: "+573001112233" },
        ]);
    });

    it("acudiente incompleto (sin relación) no envía y explica", async () => {
        const fetchMock = mockFetchOk();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "Juan" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Ramírez" } });
        fireEvent.click(screen.getByRole("button", { name: "+ Agregar acudiente (opcional)" }));
        fireEvent.change(screen.getByLabelText("Nombre del acudiente"), { target: { value: "Marta" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("error del endpoint: muestra el mensaje y no cierra", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({ error: { message: "Ya existe un alumno con ese nombre en este curso" } }),
        });
        vi.stubGlobal("fetch", fetchMock);
        const onClose = vi.fn();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={onClose} onCreado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "María" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Gómez" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(screen.getByText(/Ya existe/)).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });
});
