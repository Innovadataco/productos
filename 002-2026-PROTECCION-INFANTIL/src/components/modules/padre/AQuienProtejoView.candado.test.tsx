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
    return render(<AQuienProtejoView hijos={[]} estadoClasificador={ESTADO} circulo={CIRCULO} />);
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
