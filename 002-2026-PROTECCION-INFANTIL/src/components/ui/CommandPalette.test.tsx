/**
 * SPEC-148 (T003, FR-002) — Test de accesibilidad del primitivo CommandPalette:
 * portal, combobox/listbox aria, ↑↓ navega, Enter selecciona, Esc cierra,
 * foco al input al abrir y restauración del foco al cerrar, Tab atrapado.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette, type OpcionCommandPalette } from "./CommandPalette";

const OPCIONES: OpcionCommandPalette[] = [
    { id: "e1", grupo: "Estudiantes", titulo: "Ana Ruiz", detalle: "Séptimo A" },
    { id: "e2", grupo: "Estudiantes", titulo: "Luis Anaya", detalle: "Séptimo A" },
    { id: "c1", grupo: "Cursos", titulo: "Séptimo A", detalle: "Ana Torres" },
    { id: "p1", grupo: "Profesores", titulo: "Ana Torres" },
];

function renderPalette(props: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
    const onClose = vi.fn();
    const onSeleccionar = vi.fn();
    const onConsultaChange = vi.fn();
    render(
        <CommandPalette
            isOpen
            onClose={onClose}
            consulta="ana"
            onConsultaChange={onConsultaChange}
            opciones={OPCIONES}
            onSeleccionar={onSeleccionar}
            {...props}
        />
    );
    return { onClose, onSeleccionar, onConsultaChange };
}

describe("CommandPalette (a11y)", () => {
    it("se monta en portal con dialog modal y combobox que apunta al listbox", () => {
        renderPalette();
        const dialog = screen.getByRole("dialog");
        expect(dialog.getAttribute("aria-modal")).toBe("true");

        const combobox = screen.getByRole("combobox");
        expect(combobox.getAttribute("aria-expanded")).toBe("true");
        const listbox = screen.getByRole("listbox");
        expect(combobox.getAttribute("aria-controls")).toBe(listbox.id);
        expect(screen.getAllByRole("option")).toHaveLength(4);
        // La opción activa arranca en la primera y se anuncia vía activedescendant.
        const primera = screen.getAllByRole("option")[0]!;
        expect(primera.getAttribute("aria-selected")).toBe("true");
        expect(combobox.getAttribute("aria-activedescendant")).toBe(primera.id);
    });

    it("agrupa con encabezados visibles y muestra '+N más' por grupo", () => {
        renderPalette({ restantes: { Estudiantes: 12 } });
        expect(screen.getByText("Estudiantes")).toBeTruthy();
        expect(screen.getByText("Cursos")).toBeTruthy();
        expect(screen.getByText("Profesores")).toBeTruthy();
        expect(screen.getByText("+12 más")).toBeTruthy();
    });

    it("el foco cae en el input al abrir", async () => {
        renderPalette();
        await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("combobox")));
    });

    it("↑↓ navega la opción activa (circular) sin sacar el foco del input", async () => {
        renderPalette();
        const combobox = screen.getByRole("combobox");
        await vi.waitFor(() => expect(document.activeElement).toBe(combobox));
        const opciones = screen.getAllByRole("option");

        fireEvent.keyDown(combobox, { key: "ArrowDown" });
        expect(combobox.getAttribute("aria-activedescendant")).toBe(opciones[1]!.id);
        expect(opciones[1]!.getAttribute("aria-selected")).toBe("true");
        expect(opciones[0]!.getAttribute("aria-selected")).toBe("false");

        fireEvent.keyDown(combobox, { key: "ArrowDown" });
        fireEvent.keyDown(combobox, { key: "ArrowDown" });
        expect(combobox.getAttribute("aria-activedescendant")).toBe(opciones[3]!.id);

        // Circular: una más vuelve a la primera; ArrowUp desde ahí va a la última.
        fireEvent.keyDown(combobox, { key: "ArrowDown" });
        expect(combobox.getAttribute("aria-activedescendant")).toBe(opciones[0]!.id);
        fireEvent.keyDown(combobox, { key: "ArrowUp" });
        expect(combobox.getAttribute("aria-activedescendant")).toBe(opciones[3]!.id);

        expect(document.activeElement).toBe(combobox);
    });

    it("Enter selecciona la opción activa", () => {
        const { onSeleccionar } = renderPalette();
        const combobox = screen.getByRole("combobox");

        fireEvent.keyDown(combobox, { key: "ArrowDown" });
        fireEvent.keyDown(combobox, { key: "ArrowDown" });
        fireEvent.keyDown(combobox, { key: "Enter" });

        expect(onSeleccionar).toHaveBeenCalledTimes(1);
        expect(onSeleccionar).toHaveBeenCalledWith(OPCIONES[2]);
    });

    it("Esc cierra el palette", () => {
        const { onClose } = renderPalette();
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("al cerrar restaura el foco al elemento que lo tenía antes de abrir", async () => {
        render(<button type="button">Disparador</button>);
        const disparador = screen.getByRole("button", { name: "Disparador" });
        disparador.focus();
        const { rerender } = render(
            <CommandPalette
                isOpen
                onClose={vi.fn()}
                consulta=""
                onConsultaChange={vi.fn()}
                opciones={[]}
                onSeleccionar={vi.fn()}
            />
        );
        await vi.waitFor(() => expect(document.activeElement?.getAttribute("role")).toBe("combobox"));
        rerender(
            <CommandPalette
                isOpen={false}
                onClose={vi.fn()}
                consulta=""
                onConsultaChange={vi.fn()}
                opciones={[]}
                onSeleccionar={vi.fn()}
            />
        );
        await vi.waitFor(() => expect(document.activeElement).toBe(disparador));
    });

    it("Tab queda atrapado en el palette (focus trap)", () => {
        renderPalette();
        const combobox = screen.getByRole("combobox");
        fireEvent.keyDown(combobox, { key: "Tab" });
        expect(document.activeElement).toBe(combobox);
    });

    it("sin resultados muestra el empty state honesto (nunca una lista rota)", () => {
        renderPalette({ opciones: [], textoSinResultados: "Sin resultados para «xyz»" });
        expect(screen.queryByRole("listbox")).toBeNull();
        expect(screen.getByRole("status").textContent).toBe("Sin resultados para «xyz»");
        const combobox = screen.getByRole("combobox");
        expect(combobox.getAttribute("aria-expanded")).toBe("false");
        expect(combobox.getAttribute("aria-activedescendant")).toBeNull();
    });

    it("estado de carga anunciado con role=status", () => {
        renderPalette({ opciones: [], cargando: true });
        expect(screen.getByRole("status").textContent).toContain("Buscando");
    });

    it("cerrado no renderiza nada", () => {
        render(
            <CommandPalette
                isOpen={false}
                onClose={vi.fn()}
                consulta=""
                onConsultaChange={vi.fn()}
                opciones={[]}
                onSeleccionar={vi.fn()}
            />
        );
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
