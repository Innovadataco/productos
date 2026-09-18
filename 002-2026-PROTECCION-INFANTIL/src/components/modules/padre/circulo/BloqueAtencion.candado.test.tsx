/**
 * CANDADO · SPEC-718 (Jelkin probando 18-09 · FORMA-SPEC718 de Diseño) · «Necesita tu atención» no
 * puede afirmar un número de personas MAYOR que la cantidad de líneas que muestra.
 *
 * El defecto: el bloque decía «Hay reportes sobre 2 personas» y pintaba UNA sola línea (personas[0])
 * con un botón que abría solo a esa primera. Este candado renderiza el bloque y exige, por CONDUCTA:
 *  1. El número afirmado en el título == líneas mostradas == personas (2, 3, 4); con 2+ cada línea
 *     nombra a quién (nombre + dato).
 *  2. El bloque no lleva botón (la salida es la tarjeta de cada persona).
 *  3. Con 5+ el título dice «varias» (SIN número) y hay a lo sumo 4 líneas + una línea de cierre —
 *     el bloque nunca afirma más personas de las que lista.
 *
 * Control positivo (verificado a mano): volver a `personas[0]` en el cuerpo deja el título en N con
 * 1 línea → `afirmado <= líneas` se rompe y el candado se pone rojo.
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BloqueAtencion } from "./BloqueAtencion";
import type { Contacto } from "./tipos";

// Corte de líneas que fija la forma (Diseño §4). El test de 9 personas exige exactamente esta cantidad.
const MAX_VISIBLE = 4;
const CIERRE_LISTA = /Y otras personas de tu círculo también tienen reportes/;

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
            { id: `${id}-ident`, valor, tipo: null, plataforma: { id: "p-disc", nombre: plataforma, clave: "discord" }, activo: true },
        ],
    };
}

const N_PERSONAS = (n: number) => Array.from({ length: n }, (_, i) => persona(`c${i}`, `Persona ${i}`, `dato${i}`));

afterEach(() => cleanup());

describe("SPEC-718 · el bloque no promete más personas que líneas muestra", () => {
    it("2 personas: título dice 2, hay 2 líneas y cada una NOMBRA a quién con su dato", () => {
        render(<BloqueAtencion personas={[persona("a", "Ruby", "ruby1"), persona("b", "Carlos", "carlos1")]} />);
        expect(screen.getByText(/Hay reportes sobre 2 personas de tu círculo/)).toBeTruthy();
        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(2);
        // Cada línea nombra a la persona (con 2+) y muestra su propio dato.
        expect(items[0]!.textContent).toMatch(/Ruby/);
        expect(items[0]!.textContent).toMatch(/ruby1/);
        expect(items[1]!.textContent).toMatch(/Carlos/);
        expect(items[1]!.textContent).toMatch(/carlos1/);
    });

    it("1 persona: título «Alguien reportó a X», una línea con su dato, sin número inflado", () => {
        render(<BloqueAtencion personas={[persona("a", "Ruby", "ruby1")]} />);
        expect(screen.getByText("Alguien reportó a Ruby")).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(1);
        expect(screen.getByText("ruby1")).toBeTruthy();
        expect(screen.queryByText(/Hay reportes sobre/)).toBeNull();
    });

    it("SPEC-718 · el bloque NO lleva botón (la salida es la tarjeta de cada persona)", () => {
        render(<BloqueAtencion personas={N_PERSONAS(3)} />);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("cierre único, con «en la tarjeta» (el botón se fue), no por línea", () => {
        render(<BloqueAtencion personas={N_PERSONAS(2)} />);
        const cierres = screen.getAllByText(/Míralo con calma: en la tarjeta de cada persona/);
        expect(cierres).toHaveLength(1);
    });

    it("CANDADO invariante (2, 3, 4): el número afirmado == líneas mostradas == personas", () => {
        for (const n of [2, 3, 4]) {
            cleanup();
            render(<BloqueAtencion personas={N_PERSONAS(n)} />);
            const titulo = screen.getByText(/Hay reportes sobre \d+ personas/).textContent ?? "";
            const afirmado = Number(/sobre (\d+) personas/.exec(titulo)?.[1] ?? "0");
            const lineas = screen.getAllByRole("listitem").length;
            expect(afirmado, `afirma ${afirmado} personas pero muestra ${lineas} líneas`).toBeLessThanOrEqual(lineas);
            expect(afirmado).toBe(n);
            expect(lineas).toBe(n);
            expect(screen.queryByText(CIERRE_LISTA), "con ≤4 no hay línea de «y otras»").toBeNull();
        }
    });

    it("CANDADO 5+ (sembrar 9): título «varias» SIN número, 4 líneas + línea de cierre de lista", () => {
        render(<BloqueAtencion personas={N_PERSONAS(9)} />);
        expect(screen.getByText(/Hay reportes sobre varias personas de tu círculo/)).toBeTruthy();
        // Nunca un número en el título con 5+ (afirmaría más de lo que lista).
        expect(screen.queryByText(/Hay reportes sobre \d+ personas/)).toBeNull();
        expect(screen.getAllByRole("listitem")).toHaveLength(MAX_VISIBLE);
        expect(screen.getByText(CIERRE_LISTA)).toBeTruthy();
    });
});
