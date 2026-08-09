/**
 * SPEC-148 (T005, US1, FR-001) — Pantalla de profesores: render con filtro
 * activos por default, cambio de filtro, buscador con debounce, formulario
 * (validación humana, 400/409 con mensaje del endpoint), baja suave y
 * reactivación — todo contra el CRUD existente de SPEC-145 (sin tocarlo).
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfesoresPageClient from "./ProfesoresPageClient";

const PROFESORES = [
    { id: "p1", nombre: "María", apellidos: "López", email: "maria@colegio.edu.co", telefono: "+573001112233", estado: "activo" },
    { id: "p2", nombre: "Carlos", apellidos: "Gómez", email: null, telefono: null, estado: "activo" },
];

function mockFetchList(items: unknown[] = PROFESORES) {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items, pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ProfesoresPageClient", () => {
    it("carga activos por default y pinta la tabla", async () => {
        const fetchMock = mockFetchList();
        render(<ProfesoresPageClient />);

        expect(await screen.findByText("María López")).toBeTruthy();
        expect(screen.getByText("Carlos Gómez")).toBeTruthy();
        expect(screen.getByText("maria@colegio.edu.co")).toBeTruthy();
        expect(fetchMock.mock.calls[0]![0]).toBe("/api/colegio/profesores?estado=activo&pageSize=100");
        expect(screen.getAllByText("Activo")).toHaveLength(2);
    });

    it("el filtro de estado vuelve a consultar (inactivos)", async () => {
        const fetchMock = mockFetchList([]);
        render(<ProfesoresPageClient />);
        await screen.findByText(/No hay profesores registrados/);

        fireEvent.change(screen.getByLabelText("Filtrar por estado"), { target: { value: "inactivo" } });
        await waitFor(() =>
            expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("estado=inactivo"))).toBe(true)
        );
        expect(await screen.findByText(/No hay profesores dados de baja/)).toBeTruthy();
    });

    it("el buscador filtra con debounce y muestra empty honesto sin resultados", async () => {
        mockFetchList();
        render(<ProfesoresPageClient />);
        await screen.findByText("María López");

        fireEvent.change(screen.getByLabelText("Buscar por nombre"), { target: { value: "car" } });
        await waitFor(() => expect(screen.queryByText("María López")).toBeNull(), { timeout: 1000 });
        expect(screen.getByText("Carlos Gómez")).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Buscar por nombre"), { target: { value: "zzz" } });
        expect(await screen.findByText("Sin resultados para «zzz».", undefined, { timeout: 1000 })).toBeTruthy();
    });

    it("estado vacío con CTA 'Agregar profesor'", async () => {
        mockFetchList([]);
        render(<ProfesoresPageClient />);
        expect(await screen.findByText("No hay profesores registrados")).toBeTruthy();
        expect(screen.getAllByRole("button", { name: "Agregar profesor" }).length).toBeGreaterThan(0);
    });

    it("sin apellidos no envía y explica (validación humana)", async () => {
        const fetchMock = mockFetchList();
        render(<ProfesoresPageClient />);
        await screen.findByText("María López");

        fireEvent.click(screen.getAllByRole("button", { name: "Agregar profesor" })[0]!);
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Ana" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        expect((await screen.findByRole("alert")).textContent).toContain("Completa el nombre y los apellidos del profesor");
        // Solo el GET inicial; nada se guardó.
        expect(fetchMock.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(0);
    });

    it("alta con email/teléfono: POST al CRUD existente y mensaje de éxito", async () => {
        const fetchMock = mockFetchList();
        render(<ProfesoresPageClient />);
        await screen.findByText("María López");

        fireEvent.click(screen.getAllByRole("button", { name: "Agregar profesor" })[0]!);
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Ana" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "Torres" } });
        fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "ana@colegio.edu.co" } });
        fireEvent.change(screen.getByLabelText(/Teléfono/), { target: { value: "+573009998877" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
        const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST")!;
        expect(post[0]).toBe("/api/colegio/profesores");
        expect(JSON.parse(post[1].body)).toEqual({
            nombre: "Ana",
            apellidos: "Torres",
            email: "ana@colegio.edu.co",
            telefono: "+573009998877",
        });
        expect(await screen.findByText("Profesor agregado")).toBeTruthy();
    });

    it("409 del endpoint se muestra como aviso claro y el modal no cierra", async () => {
        const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            if (init?.method === "POST") {
                return Promise.resolve({
                    ok: false,
                    status: 409,
                    json: async () => ({ error: { message: "Ya existe un profesor con ese nombre y apellidos" } }),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ items: PROFESORES, pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 } }),
            });
        });
        vi.stubGlobal("fetch", fetchMock);
        render(<ProfesoresPageClient />);
        await screen.findByText("María López");

        fireEvent.click(screen.getAllByRole("button", { name: "Agregar profesor" })[0]!);
        fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "María" } });
        fireEvent.change(screen.getByLabelText(/Apellidos/), { target: { value: "López" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        expect((await screen.findByRole("alert")).textContent).toContain("Ya existe un profesor con ese nombre y apellidos");
        expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("edición precarga el formulario y hace PATCH con los campos", async () => {
        const fetchMock = mockFetchList();
        render(<ProfesoresPageClient />);
        await screen.findByText("María López");

        fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]!); // Carlos (sin contacto)
        expect(screen.getByRole("dialog").textContent).toContain("Editar profesor");
        expect((screen.getByLabelText(/Nombre/) as HTMLInputElement).value).toBe("Carlos");
        fireEvent.change(screen.getByLabelText(/Teléfono/), { target: { value: "+573005554444" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(true));
        const patch = fetchMock.mock.calls.find((c) => c[1]?.method === "PATCH")!;
        expect(patch[0]).toBe("/api/colegio/profesores/p2");
        expect(JSON.parse(patch[1].body)).toEqual({
            nombre: "Carlos",
            apellidos: "Gómez",
            email: null,
            telefono: "+573005554444",
        });
    });

    it("baja suave: 'Dar de baja' hace PATCH estado inactivo y avisa del titular histórico", async () => {
        const fetchMock = mockFetchList();
        render(<ProfesoresPageClient />);
        await screen.findByText("María López");

        fireEvent.click(screen.getAllByRole("button", { name: "Dar de baja" })[0]!);

        await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(true));
        const patch = fetchMock.mock.calls.find((c) => c[1]?.method === "PATCH")!;
        expect(patch[0]).toBe("/api/colegio/profesores/p1");
        expect(JSON.parse(patch[1].body)).toEqual({ estado: "inactivo" });
        expect(await screen.findByText(/Sigue como titular histórico de sus cursos/)).toBeTruthy();
    });

    it("una profesora inactiva ofrece 'Reactivar' (PATCH estado activo)", async () => {
        const fetchMock = mockFetchList([{ ...PROFESORES[0], estado: "inactivo" }]);
        render(<ProfesoresPageClient />);
        await screen.findByText("María López");
        expect(screen.getByText("Inactivo")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));

        await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(true));
        const patch = fetchMock.mock.calls.find((c) => c[1]?.method === "PATCH")!;
        expect(JSON.parse(patch[1].body)).toEqual({ estado: "activo" });
        expect(await screen.findByText(/reactivado/)).toBeTruthy();
    });
});
