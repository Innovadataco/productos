import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeccionIdentificadores } from "./SeccionIdentificadores";
import { estudianteVacio, type EstudianteForm } from "./tipos";

/**
 * SPEC-146 (T005) — SeccionIdentificadores: identificadores digitales por
 * estudiante (opcional): agregar/quitar, tipo opcional (se detecta solo),
 * plataforma del catálogo y etiqueta de relación.
 */

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function estudianteConNombre(): EstudianteForm {
    const e = estudianteVacio("est-1");
    e.nombre = "María";
    e.apellidos = "Gómez";
    return e;
}

function Harness({ inicial }: { inicial: EstudianteForm[] }) {
    const [estudiantes, setEstudiantes] = useState(inicial);
    return <SeccionIdentificadores estudiantes={estudiantes} onChange={setEstudiantes} />;
}

describe("SeccionIdentificadores", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sin estudiantes con nombre: guía a la sección 2", () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ plataformas: [] })));
        render(<Harness inicial={[estudianteVacio("est-1")]} />);
        expect(screen.getByText(/Agrega estudiantes en la sección 2/)).toBeTruthy();
    });

    it("agrega y quita un identificador por estudiante", () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => jsonResponse({ plataformas: [{ id: "pl-1", clave: "whatsapp", nombre: "WhatsApp" }] }))
        );
        render(<Harness inicial={[estudianteConNombre()]} />);
        expect(screen.getByText("María Gómez")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "+ Agregar identificador" }));
        const valor = screen.getByLabelText("Valor del identificador 1 del estudiante 1");
        fireEvent.change(valor, { target: { value: "@gamer123" } });
        expect((valor as HTMLInputElement).value).toBe("@gamer123");

        // Tipo opcional: "Se detecta solo" por defecto.
        expect((screen.getByLabelText("Tipo del identificador 1 del estudiante 1") as HTMLSelectElement).value).toBe("");

        fireEvent.click(screen.getByRole("button", { name: "Quitar identificador 1 del estudiante 1" }));
        expect(screen.queryByLabelText("Valor del identificador 1 del estudiante 1")).toBeNull();
    });
});
