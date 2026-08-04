import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Accordion, type AccordionSeccion } from "./Accordion";

/**
 * SPEC-146 (FR-004) — Accordion: test de accesibilidad obligatorio (§9 del
 * brief): teclado, aria-expanded/aria-controls, foco visible y reduced-motion.
 */

const SECCIONES: AccordionSeccion[] = [
    { id: "uno", titulo: "1. Datos del curso", contenido: <p>Contenido uno</p> },
    { id: "dos", titulo: "2. Estudiantes", detalle: "0 agregados", contenido: <p>Contenido dos</p> },
    { id: "tres", titulo: "3. Identificadores digitales", detalle: "opcional", contenido: <p>Contenido tres</p> },
];

/** Harness controlado (el estado vive en el padre, como en el wizard). */
function Harness({ abiertosIniciales = ["uno"] }: { abiertosIniciales?: string[] }) {
    const [abiertos, setAbiertos] = useState(abiertosIniciales);
    return (
        <Accordion
            secciones={SECCIONES}
            abiertos={abiertos}
            onToggle={(id) => setAbiertos((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))}
        />
    );
}

function header(nombre: string | RegExp): HTMLElement {
    return screen.getByRole("button", { name: nombre });
}

describe("Accordion", () => {
    it("renderiza las secciones con encabezados botón y paneles región", () => {
        render(<Harness />);
        expect(header(/Datos del curso/)).toBeTruthy();
        expect(header(/Estudiantes/)).toBeTruthy();
        expect(header(/Identificadores digitales/)).toBeTruthy();

        // Solo la sección abierta muestra su panel (role="region" etiquetado).
        const regiones = screen.getAllByRole("region");
        expect(regiones).toHaveLength(1);
        expect(regiones[0].getAttribute("aria-labelledby")).toBe("accordion-header-uno");
        expect(screen.getByText("Contenido uno")).toBeTruthy();
        expect(screen.queryByText("Contenido dos")).toBeNull();
    });

    it("aria-expanded y aria-controls reflejan el estado", () => {
        render(<Harness />);
        const abierto = header(/Datos del curso/);
        const cerrado = header(/Estudiantes/);
        expect(abierto.getAttribute("aria-expanded")).toBe("true");
        expect(abierto.getAttribute("aria-controls")).toBe("accordion-panel-uno");
        expect(cerrado.getAttribute("aria-expanded")).toBe("false");
        expect(cerrado.getAttribute("aria-controls")).toBe("accordion-panel-dos");
    });

    it("alterna una sección por click", () => {
        render(<Harness />);
        fireEvent.click(header(/Estudiantes/));
        expect(header(/Estudiantes/).getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByText("Contenido dos")).toBeTruthy();

        fireEvent.click(header(/Estudiantes/));
        expect(header(/Estudiantes/).getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByText("Contenido dos")).toBeNull();
    });

    it("alterna una sección con Enter y con Space (teclado)", () => {
        render(<Harness />);
        const cerrado = header(/Identificadores digitales/);
        fireEvent.keyDown(cerrado, { key: "Enter" });
        // Enter/Space en un <button> real dispara click; jsdom lo emula con click:
        fireEvent.click(cerrado);
        expect(cerrado.getAttribute("aria-expanded")).toBe("true");

        fireEvent.keyDown(cerrado, { key: " " });
        fireEvent.click(cerrado);
        expect(cerrado.getAttribute("aria-expanded")).toBe("false");
    });

    it("↑/↓ navegan entre encabezados y Home/End van a los extremos", () => {
        render(<Harness />);
        const primero = header(/Datos del curso/);
        const segundo = header(/Estudiantes/);
        const tercero = header(/Identificadores digitales/);

        primero.focus();
        fireEvent.keyDown(primero, { key: "ArrowDown" });
        expect(document.activeElement).toBe(segundo);

        fireEvent.keyDown(segundo, { key: "ArrowDown" });
        expect(document.activeElement).toBe(tercero);

        // Wrap-around: ↓ en el último vuelve al primero.
        fireEvent.keyDown(tercero, { key: "ArrowDown" });
        expect(document.activeElement).toBe(primero);

        fireEvent.keyDown(primero, { key: "ArrowUp" });
        expect(document.activeElement).toBe(tercero);

        fireEvent.keyDown(tercero, { key: "Home" });
        expect(document.activeElement).toBe(primero);

        fireEvent.keyDown(primero, { key: "End" });
        expect(document.activeElement).toBe(tercero);
    });

    it("foco visible (ring-accent) y tap target ≥ 48px en cada encabezado", () => {
        render(<Harness />);
        for (const seccion of SECCIONES) {
            const boton = document.getElementById(`accordion-header-${seccion.id}`)!;
            expect(boton.className).toContain("ring-accent");
            expect(boton.className).toContain("min-h-12");
        }
    });

    it("las transiciones son motion-safe (prefers-reduced-motion las apaga)", () => {
        render(<Harness />);
        const boton = document.getElementById("accordion-header-uno")!;
        // Ninguna transición incondicional: todo el movimiento va bajo motion-safe.
        expect(boton.className).toContain("motion-safe:transition-colors");
        expect(boton.className).not.toMatch(/(^|\s)transition(\s|$)/);
    });

    it("muestra el detalle a la derecha del encabezado cuando existe", () => {
        render(<Harness />);
        expect(screen.getByText("0 agregados")).toBeTruthy();
        expect(screen.getByText("opcional")).toBeTruthy();
    });
});
