/**
 * SPEC-660 · CANDADO del ESTADO VACÍO de «A quién protejo».
 *
 * En producción hay 4 hijos y 2 cuentas EN TOTAL: casi ningún padre tiene un menor
 * con cuenta registrada, así que el estado vacío NO es un caso de borde — es lo que
 * ve casi todo el mundo el primer día. Superficie de día-uno ⇒ candado de CONDUCTA,
 * no de «que renderice». Cada aserción CAE bajo su mutación:
 *  - NUNCA rojo (SPEC-362): la falta de menores no es una alarma. → cae si se pinta rojo.
 *  - El CTA lleva a /dashboard/padre/perfil#menores (donde vive el alta, Fase C). → cae
 *    si cambia el destino.
 *  - Renderiza por la rama VACÍA con hijos=[], sin caer a la rama no-vacía. → cae si se
 *    rompe la guarda `hijos.length === 0`.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AQuienProtejoView } from "./AQuienProtejoView";

const ESTADO = { motorVivo: true, ultimaVerificacionEn: null };
const CIRCULO = { personas: 0, todasTranquilas: false };

function pintarVacio() {
    return render(<AQuienProtejoView hijos={[]} estadoClasificador={ESTADO} cuentasConReporte={0} circulo={CIRCULO} />);
}

describe("SPEC-660 · estado vacío de «A quién protejo» (render)", () => {
    it("NUNCA rojo: la falta de menores no es una alarma", () => {
        const { container } = pintarVacio();
        expect(container.innerHTML).not.toMatch(/rubi|\brojo\b|\bred\b/i);
    });

    it("el CTA de registrar apunta a /perfil#menores (donde vive el alta, Fase C)", () => {
        const { getByRole } = pintarVacio();
        const cta = getByRole("link", { name: /agregar un menor/i });
        expect(cta.getAttribute("href")).toBe("/dashboard/padre/perfil#menores");
    });

    it("renderiza por la rama vacía con hijos=[] (no cae a la rama no-vacía)", () => {
        const { getByRole, queryByText } = pintarVacio();
        // el CTA del estado vacío existe: getByRole lanza si la rama vacía se rompe.
        expect(getByRole("link", { name: /agregar un menor/i })).toBeTruthy();
        // y NO se renderizó la rama no-vacía (la única que ofrece «Gestionar en tu perfil»).
        expect(queryByText(/Gestionar en tu perfil/i)).toBeNull();
    });
});

/**
 * SPEC-716 (Parte A · I-427) · La línea, EN EL ÁRBOL DE RENDER DE LA VISTA (no aislada), no puede
 * afirmar «Sin reportes» cuando hay cuentas reportadas y el motor está vivo. Derivado de la vista
 * que la página monta (`AQuienProtejoView`), así que si mañana la línea se mueve dentro de la vista,
 * el candado la sigue cubriendo. Control positivo: las MISMAS condiciones con 0 cuentas → reaparece.
 */
describe("SPEC-716 (Parte A · I-427) · la línea, en el árbol de la vista, no miente sobre reportes", () => {
    const HIJO = { id: "h1", nombre: "Zaira", activo: true, tieneCuentasActivas: true, tieneReportes: true };
    const pintar = (cuentasConReporte: number, motorVivo = true) =>
        render(
            <AQuienProtejoView
                hijos={[HIJO]}
                estadoClasificador={{ motorVivo, ultimaVerificacionEn: null }}
                cuentasConReporte={cuentasConReporte}
                circulo={CIRCULO}
            />,
        );

    it("motor vivo + ≥1 cuenta reportada → «necesita tu atención», NUNCA «Sin reportes»", () => {
        const t = pintar(1).container.textContent ?? "";
        expect(t, "el gráfico pinta ámbar y la línea no puede decir «Sin reportes» (I-427)").not.toContain("Sin reportes");
        expect(t).toContain("necesita tu atención");
    });

    it("CONTROL POSITIVO · las MISMAS condiciones con 0 cuentas → sí dice «Sin reportes»", () => {
        const t = pintar(0).container.textContent ?? "";
        expect(t).toContain("Sin reportes");
        expect(t).not.toMatch(/necesita tu atención/);
    });
});
