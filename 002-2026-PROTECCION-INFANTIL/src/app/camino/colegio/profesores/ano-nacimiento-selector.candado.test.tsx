/**
 * SPEC-954 (I-… · Jelkin vivo, prod e3d0f98f) · CANDADO del paso REAL donde se vio
 * el defecto: /camino/colegio/profesores. El «Año de nacimiento» del alta del
 * profesor es un SELECTOR (lista 18–80), no un `<input type="number">` libre que
 * dejaba teclear «2000888888» y sólo fallaba al enviar.
 *
 * Muere si este formulario vuelve a un campo numérico libre.
 *
 * Unit (jsdom): mockea next/navigation, fetch y el hijo pesado de carga Excel;
 * no toca la base. Registrado en vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// El widget de carga masiva por Excel no es parte de este candado.
vi.mock("@/components/modules/colegio/CargaProfesoresExcel", () => ({
    CargaProfesoresExcel: () => <div data-testid="carga-excel-mock" />,
}));

import PasoProfesoresColegio from "./page";

describe("SPEC-954 · /camino/colegio/profesores: el año es un selector, no un número libre", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ profesores: [], items: [] }) })),
        );
    });

    it("el campo «Año de nacimiento» del alta es un <select> y no hay input numérico libre", async () => {
        const { container } = render(<PasoProfesoresColegio />);
        const anio = (await screen.findByLabelText("Año de nacimiento")) as HTMLElement;
        expect(anio.tagName).toBe("SELECT");
        expect(container.querySelector('input[type="number"]')).toBeNull();
    });
});
