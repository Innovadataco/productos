import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingHero } from "./LandingHero";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./ConsultaForm", () => ({
    ConsultaForm: () => <div data-testid="consulta-form" />,
}));

import { RPT_STORAGE_KEY } from "./HomePageClient";

const RESULTADO_BASE = {
    identificador: "+57300TEST",
    tieneReportes: true,
    totalReportes: 4,
    reportesAutenticados: 1,
    reportesAnonimos: 3,
    actividad: "baja" as const,
    resumenPlataformas: "4 reportes en Roblox y WhatsApp",
    plataformas: [
        { id: "p1", nombre: "Roblox", total: 2 },
        { id: "p2", nombre: "WhatsApp", total: 2 },
    ],
    ubicaciones: [{ pais: "Colombia" }],
    autenticado: false,
};

function renderHero(resultado: unknown = null, buscado = false) {
    return render(
        <LandingHero onSearch={() => {}} data={resultado as never} isLoading={false} error={null} buscado={buscado} />
    );
}

describe("LandingHero — campo RPT dentro de 'Crear un reporte' (spec 091-B)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it("el campo RPT está dentro de la tarjeta 'Crear un reporte', discreto", () => {
        renderHero();
        expect(screen.getByText("¿Ya reportaste? Consulta el estado de tu reporte")).toBeTruthy();
        expect(screen.getByPlaceholderText("RPT-XXXXXX")).toBeTruthy();
    });

    it("transporta el RPT por sessionStorage y navega a /seguimiento SIN query string", () => {
        renderHero();
        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), { target: { value: "RPT-ABC123" } });
        fireEvent.click(screen.getByRole("button", { name: "Ver estado" }));

        expect(sessionStorage.getItem(RPT_STORAGE_KEY)).toBe("RPT-ABC123");
        expect(mockPush).toHaveBeenCalledWith("/seguimiento");
        expect(mockPush.mock.calls[0][0]).not.toContain("RPT-ABC123");
    });
});

describe("LandingHero — UN SOLO formato de resultado (spec 091-A)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([1, 2, 4])("con %i reportes muestra el MISMO formato (resumen, país, totales, actividad)", (n) => {
        renderHero({ ...RESULTADO_BASE, totalReportes: n, resumenPlataformas: undefined }, true);

        const body = document.body.textContent ?? "";
        const esperado = n === 1 ? "1 reporte en Roblox y WhatsApp" : `${n} reportes en Roblox y WhatsApp`;
        expect(body).toContain(esperado);
        expect(body).toContain("País: Colombia");
        expect(body).toContain(`Total: ${n} · Autenticados: 1 · Anónimos: 3`);
        expect(body).toContain("Actividad baja de reportes");
        // Sin ciudad (fuga 089) ni "(undefined)"
        expect(body).not.toContain("Bogotá");
        expect(body).not.toContain("undefined");
        // El chip de reportes es consistente (siempre visible)
        expect(body).toContain(`${n} reportes`);
    });

    it("no muestra 'Nivel de riesgo' ni link a /consulta", () => {
        renderHero(RESULTADO_BASE, true);
        const body = document.body.textContent ?? "";
        expect(body).not.toContain("Nivel de riesgo");
        expect(document.querySelector('a[href*="/consulta"]')).toBeNull();
    });
});
