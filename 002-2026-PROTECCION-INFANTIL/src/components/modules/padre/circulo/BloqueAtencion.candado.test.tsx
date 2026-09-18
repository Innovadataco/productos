/**
 * CANDADO · SPEC-718 (Jelkin probando 18-09) · «Necesita tu atención» no puede afirmar un número
 * de personas MAYOR que la cantidad de líneas que muestra.
 *
 * El defecto: el bloque decía «Hay reportes sobre 2 personas» y pintaba UNA sola línea (la de
 * `personas[0]`) con un botón que abría solo a esa primera. Este candado renderiza el bloque y
 * exige, por CONDUCTA: el número afirmado en el título == líneas mostradas == personas de entrada,
 * en escenarios con 2 y 3. Y que el bloque no lleva botón (la salida es la tarjeta de cada persona).
 *
 * Control positivo (verificado a mano): volver a `personas[0]` en el cuerpo deja el título en N con
 * 1 línea → `afirmado <= líneas` se rompe y el candado se pone rojo.
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BloqueAtencion } from "./BloqueAtencion";
import type { Contacto } from "./tipos";

function persona(id: string, nombre: string, valor: string, plataforma = "Discord"): Contacto {
    return {
        id,
        nombre,
        parentesco: "hijo",
        etiqueta: null,
        nota: null,
        activo: true,
        creadoEn: "2026-09-18T00:00:00Z",
        estado: "clasificado",
        totalReportes: 1,
        identificadores: [
            {
                id: `${id}-ident`,
                valor,
                tipo: null,
                plataforma: { id: "p-disc", nombre: plataforma, clave: "discord" },
                activo: true,
            },
        ],
    };
}

const N_PERSONAS = (n: number) =>
    Array.from({ length: n }, (_, i) => persona(`c${i}`, `Persona ${i}`, `dato${i}`));

afterEach(() => cleanup());

describe("SPEC-718 · el bloque no promete más personas que líneas muestra", () => {
    it("2 personas: título dice 2 y hay 2 líneas, cada una con su dato", () => {
        render(<BloqueAtencion personas={[persona("a", "Ruby", "ruby1"), persona("b", "Carlos", "carlos1")]} />);
        expect(screen.getByText(/Hay reportes sobre 2 personas de tu círculo/)).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByText("ruby1")).toBeTruthy();
        expect(screen.getByText("carlos1")).toBeTruthy();
    });

    it("1 persona: título «Alguien reportó a X», una línea, sin número inflado", () => {
        render(<BloqueAtencion personas={[persona("a", "Ruby", "ruby1")]} />);
        expect(screen.getByText("Alguien reportó a Ruby")).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(1);
        expect(screen.queryByText(/Hay reportes sobre/)).toBeNull();
    });

    it("SPEC-718 · el bloque NO lleva botón (la salida es la tarjeta de cada persona)", () => {
        render(<BloqueAtencion personas={N_PERSONAS(2)} />);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("CANDADO invariante: el número afirmado NUNCA supera las líneas mostradas (2 y 3)", () => {
        for (const n of [2, 3]) {
            cleanup();
            render(<BloqueAtencion personas={N_PERSONAS(n)} />);
            const titulo = screen.getByText(/Hay reportes sobre \d+ personas/).textContent ?? "";
            const afirmado = Number(/sobre (\d+) personas/.exec(titulo)?.[1] ?? "0");
            const lineas = screen.getAllByRole("listitem").length;
            expect(afirmado, `afirma ${afirmado} personas pero muestra ${lineas} líneas`).toBeLessThanOrEqual(lineas);
            // Y, exacto: el título, las líneas y la entrada coinciden.
            expect(afirmado).toBe(n);
            expect(lineas).toBe(n);
        }
    });
});
