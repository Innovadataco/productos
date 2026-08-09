/**
 * SPEC-147 (T005, FR-004) — TablaEstudiantes: filas con acudiente clicable y
 * acciones, buscador con debounce 280 ms, estado vacío del filtro.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { TablaEstudiantes } from "./TablaEstudiantes";
import type { EstudianteFila } from "./TablaEstudiantes";

const ESTUDIANTES: EstudianteFila[] = [
    {
        id: "e1",
        nombre: "Ana",
        apellidos: "Pérez Torres",
        estado: "activo",
        identificadores: [{ id: "i1" }, { id: "i2" }],
        acudientes: [{ nombre: "Marta Torres", relacion: "madre", telefono: "+573001112233", email: null }],
    },
    {
        id: "e2",
        nombre: "Juan",
        apellidos: "Ramírez",
        estado: "activo",
        identificadores: [],
        acudientes: [],
    },
];

afterEach(() => {
    vi.useRealTimers();
});

describe("TablaEstudiantes", () => {
    it("renderiza filas con acudiente clicable, badge, Ver y Desactivar", () => {
        const onToggle = vi.fn();
        render(<TablaEstudiantes estudiantes={ESTUDIANTES} onToggleEstado={onToggle} />);

        expect(screen.getByText("Ana Pérez Torres")).toBeTruthy();
        expect(screen.getByText("2 identificadores")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Llamar a Marta Torres" }).getAttribute("href")).toBe("tel:+573001112233");
        expect(screen.getByText("sin contactos")).toBeTruthy();

        const ver = screen.getAllByRole("link", { name: "Ver" });
        expect(ver[0]!.getAttribute("href")).toBe("/dashboard/colegio/alumnos/e1");

        const desactivar = screen.getAllByRole("button", { name: "Desactivar" });
        fireEvent.click(desactivar[0]!);
        expect(onToggle).toHaveBeenCalledWith(ESTUDIANTES[0]);
    });

    it("el buscador filtra por nombre/apellidos con debounce (no antes de 280 ms)", () => {
        vi.useFakeTimers();
        render(<TablaEstudiantes estudiantes={ESTUDIANTES} onToggleEstado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText("Buscar por nombre"), { target: { value: "ramírez" } });
        // Antes del debounce: siguen todas las filas.
        expect(screen.getByText("Ana Pérez Torres")).toBeTruthy();

        act(() => vi.advanceTimersByTime(300));
        expect(screen.queryByText("Ana Pérez Torres")).toBeNull();
        expect(screen.getByText("Juan Ramírez")).toBeTruthy();
    });

    it("filtro sin coincidencias: estado vacío propio del filtro", () => {
        vi.useFakeTimers();
        render(<TablaEstudiantes estudiantes={ESTUDIANTES} onToggleEstado={vi.fn()} />);

        fireEvent.change(screen.getByLabelText("Buscar por nombre"), { target: { value: "zzz" } });
        act(() => vi.advanceTimersByTime(300));
        expect(screen.getByText("Sin resultados para «zzz».")).toBeTruthy();
    });

    it("togglingId pone el botón de esa fila en loading (spinner, sin texto)", () => {
        render(<TablaEstudiantes estudiantes={ESTUDIANTES} onToggleEstado={vi.fn()} togglingId="e2" />);
        // El botón en loading reemplaza su texto por el spinner: solo queda el de la otra fila.
        const activos = screen.getAllByRole("button", { name: "Desactivar" });
        expect(activos).toHaveLength(1);
        expect(activos[0]!.closest("tr")!.textContent).toContain("Ana Pérez Torres");
    });
});
