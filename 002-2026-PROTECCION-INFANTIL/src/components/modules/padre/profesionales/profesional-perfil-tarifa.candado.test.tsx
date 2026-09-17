/**
 * CANDADO · SPEC-685 (Diseño) · La tarifa de la 2ª cita en el perfil que ve la FAMILIA:
 * se muestra SOLO si es > 0; con 0 o null dice «por definir», NUNCA «$0».
 *
 * Un «$0» le diría a la familia que las citas siguientes son gratis — falso. La regla
 * es «> 0» (misma que cita.service), no «!== null»: un 0 (viejo centinela) también es
 * «por definir». Render real, mutación verificable.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

// El panel de reserva hace fetch al montar; lo aislamos (tiene su propio candado).
vi.mock("@/components/modules/padre/profesionales/SolicitarCitaPanel", () => ({
    SolicitarCitaPanel: () => <div data-testid="panel" />,
}));
vi.mock("@/components/modules/CanalesOficiales", () => ({
    CanalesOficiales: () => <div data-testid="canales" />,
}));

import { ProfesionalPerfil } from "./ProfesionalPerfil";

const BASE: PerfilPublicoDTO = {
    id: "prof-1",
    nombreVisible: "Dra. Ana Pérez",
    fotoUrl: null,
    tituloProfesional: "Psicóloga clínica",
    especialidades: ["Ansiedad"],
    ciudadId: "c1",
    ciudad: { id: "c1", nombre: "Bogotá", pais: "Colombia" },
    atiendeVirtual: true,
    atiendePresencial: false,
    aniosExperiencia: 8,
    presentacion: "Acompaño familias.",
    tarifaConsultaCOP: 120_000,
    duracionMinutos: 50,
    emiteFactura: true,
};

function pintar(tarifa: number | null) {
    return render(<ProfesionalPerfil p={{ ...BASE, tarifaConsultaCOP: tarifa }} precioEstandarPrimeraCitaCOP={50_000} />);
}

describe("SPEC-685 · ProfesionalPerfil · tarifa de la 2ª cita: «por definir», nunca «$0»", () => {
    it("tarifa > 0: muestra el monto y NO dice «por definir»", () => {
        const { container } = pintar(120_000);
        expect(container.textContent).toContain("120.000");
        expect(container.textContent).not.toContain("por definir");
    });

    it("tarifa null («por fijar»): dice «por definir», sin «$0»", () => {
        const { container } = pintar(null);
        expect(screen.getByText(/por definir/)).toBeTruthy();
        expect(/\$\s?0(?!\d)/.test(container.textContent ?? "")).toBe(false);
    });

    it("tarifa 0 (viejo centinela): dice «por definir», sin «$0» — la regla es > 0", () => {
        const { container } = pintar(0);
        expect(screen.getByText(/por definir/)).toBeTruthy();
        expect(/\$\s?0(?!\d)/.test(container.textContent ?? "")).toBe(false);
    });
});
