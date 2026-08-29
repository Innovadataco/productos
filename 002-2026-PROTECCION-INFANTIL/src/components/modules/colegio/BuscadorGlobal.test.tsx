/**
 * SPEC-148 (T004, US2) — BuscadorGlobal: ⌘K/Ctrl+K abre el palette, debounce
 * 280 ms, mínimo 2 caracteres (sin fetch si no), resultados agrupados con
 * contexto y "+N más", Enter navega al destino y cierra, empty honesto.
 */
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BuscadorGlobal } from "./BuscadorGlobal";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

const DTO = {
    estudiantes: [{ id: "e1", nombre: "Ana", apellidos: "Ruiz", curso: "Séptimo A" }],
    cursos: [{ id: "c1", nombre: "Séptimo A", titular: "Ana Torres" }],
    profesores: [{ id: "p1", nombre: "Ana", apellidos: "Torres" }],
    restantes: { estudiantes: 3, cursos: 0, profesores: 0 },
};

function mockFetch(dto: unknown = DTO, ok = true) {
    const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => dto });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function abrirConComandoK(key = "k", opts: { metaKey?: boolean; ctrlKey?: boolean } = { metaKey: true }) {
    fireEvent.keyDown(document, { key, ...opts });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("BuscadorGlobal", () => {
    beforeEach(() => {
        pushMock.mockClear();
    });

    it("⌘K abre el palette y Esc lo cierra", async () => {
        mockFetch();
        render(<BuscadorGlobal />);
        expect(screen.queryByRole("dialog")).toBeNull();

        abrirConComandoK();
        expect(screen.getByRole("dialog")).toBeTruthy();

        fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("Ctrl+K también abre el palette", () => {
        mockFetch();
        render(<BuscadorGlobal />);
        abrirConComandoK("k", { ctrlKey: true });
        expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("menos de 2 caracteres no consulta el endpoint", async () => {
        const fetchMock = mockFetch();
        render(<BuscadorGlobal />);
        abrirConComandoK();
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });

        await new Promise((r) => setTimeout(r, 400));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole("status").textContent).toContain("al menos 2 caracteres");
    });

    it("consulta con debounce y pinta resultados agrupados con contexto y '+N más'", async () => {
        const fetchMock = mockFetch();
        render(<BuscadorGlobal />);
        abrirConComandoK();
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "ana" } });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock.mock.calls[0]![0]).toBe("/api/colegio/buscar?q=ana");

        expect(await screen.findByText("Ana Ruiz")).toBeTruthy();
        // "Séptimo A" aparece dos veces: curso del estudiante y nombre del curso.
        expect(screen.getAllByText("Séptimo A")).toHaveLength(2);
        expect(screen.getByText("Titular: Ana Torres")).toBeTruthy();
        expect(screen.getByText("Estudiantes")).toBeTruthy();
        expect(screen.getByText("Cursos")).toBeTruthy();
        expect(screen.getByText("Profesores")).toBeTruthy();
        expect(screen.getByText("+3 más")).toBeTruthy();
    });

    it("Enter navega al destino de cada tipo y cierra el palette", async () => {
        mockFetch();
        render(<BuscadorGlobal />);
        abrirConComandoK();
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "ana" } });
        await screen.findByText("Ana Ruiz");

        const combobox = screen.getByRole("combobox");
        // Estudiante (primera opción) → su ficha.
        fireEvent.keyDown(combobox, { key: "Enter" });
        expect(pushMock).toHaveBeenCalledWith("/dashboard/colegio/alumnos/e1");
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("los destinos de curso y profesor son los acordados", async () => {
        mockFetch();
        render(<BuscadorGlobal />);
        abrirConComandoK();
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "ana" } });
        await screen.findByText("Ana Ruiz");

        const combobox = screen.getByRole("combobox");
        fireEvent.keyDown(combobox, { key: "ArrowDown" }); // curso
        fireEvent.keyDown(combobox, { key: "Enter" });
        expect(pushMock).toHaveBeenCalledWith("/dashboard/colegio/cursos/c1");

        abrirConComandoK();
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "ana" } });
        await screen.findByText("Ana Ruiz");
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" }); // profesor
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
        expect(pushMock).toHaveBeenCalledWith("/dashboard/colegio/profesores");
    });

    it("sin resultados muestra el empty state honesto con la consulta", async () => {
        mockFetch({ estudiantes: [], cursos: [], profesores: [], restantes: { estudiantes: 0, cursos: 0, profesores: 0 } });
        render(<BuscadorGlobal />);
        abrirConComandoK();
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "xyz" } });

        await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Sin resultados para «xyz»"));
    });
});
