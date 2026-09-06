/**
 * SPEC-565 (I-348) · CANDADO: al EDITAR un hijo, la edad se elige con un SELECTOR
 * (5-17), no con un campo de año a mano.
 *
 * El servidor ya rechaza años fuera de [Y-17, Y-5] (validarAnioNacimientoMenor, en
 * alta y edición) — eso NO se toca. El bug de I-348 era el INPUT de editar: un
 * `<input type="number">` libre aceptaba teclear 1900 o 2050. Alinear con el alta
 * (que usa selector de edad desde SPEC-361/F8: «Jelkin escribía el año y se
 * equivocaba») elimina la CLASE de error, no solo la acota.
 *
 * Muere si el control de edición vuelve a ser un número libre.
 * Integración (jsdom); no toca vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { HijoCard, type Hijo } from "./HijoCard";
import { anioDesdeEdad } from "@/lib/padre/documento-menor";

const noop = vi.fn(async () => {});

function hijo(): Hijo {
    return {
        id: "h1",
        nombre: "Juan",
        apellidos: "Pérez",
        documentoTipo: "TI",
        documentoNumero: "1030000001",
        anioNacimiento: anioDesdeEdad(12), // 12 años en el año en curso
        sexo: "M",
        estado: "activo",
        identificadores: [],
    } as Hijo;
}

function renderEditando() {
    const r = render(
        <HijoCard
            hijo={hijo()}
            opcionesPlataforma={[{ value: "", label: "Elige una plataforma" }]}
            onCambiarEstadoHijo={noop}
            onEditarHijo={noop}
            onCambiarEstadoIdentificador={noop}
            onDesvincular={noop}
            onAgregarIdentificador={noop}
        />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    return r;
}

describe("SPEC-565 · editar hijo: la edad es un selector, no un año libre", () => {
    it("el control de edad es un <select> con edades 5-17, no un input de número", () => {
        const { container } = renderEditando();
        const edad = screen.getByLabelText("Edad") as HTMLElement;
        expect(edad.tagName).toBe("SELECT");
        // ofrece el rango de menor
        expect(within(edad).getByRole("option", { name: "5 años" })).toBeTruthy();
        expect(within(edad).getByRole("option", { name: "17 años" })).toBeTruthy();
        // NO hay un campo de número libre para el año en el formulario de edición
        expect(container.querySelector('input[type="number"]')).toBeNull();
    });

    it("no ofrece edades fuera del rango de un menor (ni 4 ni 18)", () => {
        renderEditando();
        const edad = screen.getByLabelText("Edad") as HTMLElement;
        expect(within(edad).queryByRole("option", { name: "4 años" })).toBeNull();
        expect(within(edad).queryByRole("option", { name: "18 años" })).toBeNull();
    });
});
