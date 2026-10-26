/**
 * SPEC-147 (T006, FR-005) — FormAgregarEstudiante: alta con nombre + apellidos
 * obligatorios y acudiente opcional, contra el endpoint existente.
 *
 * SPEC-910 (CANDADO que muere con el defecto): el documento del estudiante es
 * OBLIGATORIO (SPEC-320 §2.2-bis / estudianteBodySchema). El modal debe (a) rendir
 * el select de tipo + el input de número, y (b) sin documento NO postear (mensaje
 * inline, no el 400) / con documento, el body del POST incluir documentoTipo +
 * documentoNumero. Sin el fix, el modal posteaba sin documento → 400 "Falta el tipo
 * de documento del estudiante" y el usuario sin dónde ponerlo.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormAgregarEstudiante } from "./FormAgregarEstudiante";

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * Mock de fetch consciente de la URL: el modal consulta `/api/colegio/tipos-documento`
 * (hook del select) además de postear a `/alumnos`. Devolvemos el catálogo para el
 * primero y la respuesta del alta para el segundo.
 */
function mockFetch(post?: { ok: boolean; status: number; body: unknown }) {
    const fetchMock = vi.fn((url: string) => {
        if (String(url).includes("/tipos-documento")) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ items: [{ clave: "TI", nombre: "Tarjeta de identidad" }, { clave: "CC", nombre: "Cédula" }] }),
            });
        }
        return Promise.resolve({
            ok: post?.ok ?? true,
            status: post?.status ?? 201,
            json: async () => post?.body ?? { alumno: { id: "nuevo" } },
        });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

/** La llamada al endpoint de alta (no la del catálogo de tipos). */
function llamadaAlta(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls.find((c) => String(c[0]).includes("/alumnos"));
}

function llenarDocumento() {
    fireEvent.change(screen.getByLabelText("Tipo de documento"), { target: { value: "TI" } });
    fireEvent.change(screen.getByLabelText("Número de documento"), { target: { value: "1012345678" } });
}

describe("FormAgregarEstudiante", () => {
    it("(a) rinde el select de tipo de documento y el input de número", () => {
        mockFetch();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);
        expect(screen.getByLabelText("Tipo de documento")).toBeTruthy();
        expect(screen.getByLabelText("Número de documento")).toBeTruthy();
    });

    it("sin nombre/apellidos válidos no envía y muestra el error", async () => {
        const fetchMock = mockFetch();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(llamadaAlta(fetchMock)).toBeUndefined();
    });

    it("(b) sin documento NO postea y explica inline (no el 400 del endpoint)", async () => {
        const fetchMock = mockFetch();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "María" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Gómez Torres" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        const alerta = await screen.findByRole("alert");
        expect(alerta.textContent).toMatch(/número de documento/i);
        expect(llamadaAlta(fetchMock)).toBeUndefined();
    });

    it("(b) con documento: el body del POST incluye documentoTipo + documentoNumero", async () => {
        const fetchMock = mockFetch();
        const onCreado = vi.fn();
        const onClose = vi.fn();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={onClose} onCreado={onCreado} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "María" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Gómez Torres" } });
        llenarDocumento();
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => expect(llamadaAlta(fetchMock)).toBeTruthy());
        const [url, init] = llamadaAlta(fetchMock)!;
        expect(url).toBe("/api/colegio/cursos/c1/alumnos");
        expect(JSON.parse(init.body)).toEqual({
            nombre: "María",
            apellidos: "Gómez Torres",
            documentoTipo: "TI",
            documentoNumero: "1012345678",
        });
        await waitFor(() => expect(onCreado).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("alta con acudiente: el body lleva documento + acudientes con orden 1 y solo lo diligenciado", async () => {
        const fetchMock = mockFetch();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "Juan" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Ramírez" } });
        llenarDocumento();
        fireEvent.click(screen.getByRole("button", { name: "+ Agregar acudiente (opcional)" }));
        fireEvent.change(screen.getByLabelText("Nombre del acudiente"), { target: { value: "Marta Torres" } });
        fireEvent.change(screen.getByLabelText("Relación del acudiente"), { target: { value: "madre" } });
        fireEvent.change(screen.getByLabelText("Teléfono del acudiente"), { target: { value: "+573001112233" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        await waitFor(() => expect(llamadaAlta(fetchMock)).toBeTruthy());
        const body = JSON.parse(llamadaAlta(fetchMock)![1].body);
        expect(body.documentoTipo).toBe("TI");
        expect(body.documentoNumero).toBe("1012345678");
        expect(body.acudientes).toEqual([
            { orden: 1, nombre: "Marta Torres", relacion: "madre", telefono: "+573001112233" },
        ]);
    });

    it("acudiente incompleto (sin relación) no envía y explica", async () => {
        const fetchMock = mockFetch();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={vi.fn()} onCreado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "Juan" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Ramírez" } });
        llenarDocumento();
        fireEvent.click(screen.getByRole("button", { name: "+ Agregar acudiente (opcional)" }));
        fireEvent.change(screen.getByLabelText("Nombre del acudiente"), { target: { value: "Marta" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(llamadaAlta(fetchMock)).toBeUndefined();
    });

    it("error del endpoint: muestra el mensaje y no cierra", async () => {
        const fetchMock = mockFetch({ ok: false, status: 409, body: { error: { message: "Ya existe un alumno con ese nombre en este curso" } } });
        const onClose = vi.fn();
        render(<FormAgregarEstudiante cursoId="c1" isOpen onClose={onClose} onCreado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Nombre del estudiante/), { target: { value: "María" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Gómez" } });
        llenarDocumento();
        fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(screen.getByText(/Ya existe/)).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });
});
