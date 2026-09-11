/**
 * SPEC-660 · Candado de conducta del gráfico de «A quién protejo» (Estado A).
 *
 * Vigila las invariantes de forma que blindan el diseño (FORMA-SPEC660):
 *  1. NUNCA rojo/rubí — el peso lo carga el copy, no el color (SPEC-362).
 *  2. El HUECO DE COBERTURA (hijo activo sin cuentas) es CIELO, no ámbar: un
 *     por-hacer, no una alarma. Un color = un significado (ámbar es del reporte).
 *  3. NINGÚN número de reportantes sobre un nodo/arco (imposibilidad estructural):
 *     el gráfico muestra ESTADO, no cuenta. El único texto por hijo es inicial +
 *     nombre + subtítulo de estado. Muere si alguien agrega un contador.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GraficoProteccion, type HijoGrafico } from "./GraficoProteccion";

const HIJOS: HijoGrafico[] = [
    { id: "1", nombre: "Mateo Restrepo", estado: "tranquilo" },
    { id: "2", nombre: "Lucía Restrepo", estado: "sin-cuentas" },
    { id: "3", nombre: "Tomás Restrepo", estado: "en-pausa" },
];

describe("SPEC-660 · gráfico de protección (conducta)", () => {
    it("NUNCA rojo/rubí en ningún estado", () => {
        const { container } = render(<GraficoProteccion hijos={HIJOS} circuloPersonas={4} />);
        const svg = container.innerHTML;
        expect(svg).not.toMatch(/rubi|--rubi|\brojo\b|\bred\b|#f00|#ff0000/i);
    });

    it("el hueco de cobertura (sin-cuentas) es CIELO, no ámbar", () => {
        const soloHueco = render(<GraficoProteccion hijos={[HIJOS[1]!]} circuloPersonas={0} />);
        const svg = soloHueco.container.innerHTML;
        expect(svg, "el nodo sin-cuentas debe pintarse con el token cielo").toMatch(/--cielo-rgb/);
        expect(svg, "el hueco de cobertura NO es ámbar (ámbar se reserva al reporte)").not.toMatch(/--ambar-rgb/);
    });

    it("ningún número de reportantes sobre un nodo (solo inicial + nombre + estado)", () => {
        const { container } = render(<GraficoProteccion hijos={HIJOS} circuloPersonas={4} />);
        const textos = Array.from(container.querySelectorAll("text")).map((t) => t.textContent ?? "");
        // Todo el texto del gráfico debe ser inicial (1 letra), primer nombre, o el
        // subtítulo de estado. Un dígito suelto == un contador de reportantes coló.
        const permitido = new Set<string>();
        for (const h of HIJOS) {
            permitido.add(h.nombre.trim()[0]!.toUpperCase());
            permitido.add(h.nombre.trim().split(/\s+/)[0]!);
        }
        for (const s of ["tranquilo", "sin cuentas", "en pausa"]) permitido.add(s);
        for (const t of textos) {
            expect(permitido.has(t), `texto inesperado en el gráfico (¿contador de reportantes?): "${t}"`).toBe(true);
            expect(/^\d+$/.test(t.trim()), `número suelto sobre un nodo: "${t}"`).toBe(false);
        }
    });
});
