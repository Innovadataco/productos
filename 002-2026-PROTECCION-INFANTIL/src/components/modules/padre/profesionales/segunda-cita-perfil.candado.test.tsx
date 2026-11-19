/**
 * CANDADO · SPEC-940 — la ficha no ofrece el panel de reserva cuando PI ya no intermedia (2.ª cita con el mismo
 * profesional tras una confirmada) y la tarifa del profesional se presenta como INFORMATIVA (la red no la cobra).
 * El rechazo real vive en el servidor (`segunda-cita.candado.test.ts`); esto evita un panel que no va a funcionar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

vi.mock("@/components/modules/padre/profesionales/SolicitarCitaPanel", () => ({
    SolicitarCitaPanel: () => <div data-testid="panel" />,
}));
vi.mock("@/components/modules/CanalesOficiales", () => ({
    CanalesOficiales: () => <div data-testid="canales" />,
}));

import { ProfesionalPerfil } from "./ProfesionalPerfil";
import { desglosarTarifa } from "@/lib/profesional/cita/comision";
import { FRAGMENTO_SEGUNDA_CITA_CANAL } from "@/lib/profesional/cita/segunda-cita";

const BASE: PerfilPublicoDTO = {
    id: "prof-1",
    nombreVisible: "Dra. Ana Pérez",
    fotoUrl: null,
    tituloProfesional: "Psicóloga clínica",
    especialidades: ["Ansiedad"],
    rangoEtario: [], // SPEC-816: campo nuevo del DTO (no lo ejercita este test)
    tieneHorariosDisponibles: true, // SPEC-818: campo nuevo del DTO (no lo ejercita este test)
    esNuevo: true, // SPEC-872: campo nuevo del DTO (no lo ejercita este test)
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

describe("SPEC-940 · ficha: 2.ª cita fuera de PI + tarifa informativa", () => {
    it("con cita confirmada previa: aviso y SIN panel de reserva", () => {
        render(<ProfesionalPerfil p={BASE} cotizacion={desglosarTarifa(50_000, 10)} segundaCitaFueraDePi />);
        expect(screen.getByTestId("segunda-cita-fuera-de-pi").textContent).toContain(FRAGMENTO_SEGUNDA_CITA_CANAL);
        expect(screen.queryByTestId("panel")).toBeNull();
        cleanup();
    });

    it("control: sin cita previa → panel de reserva, sin aviso", () => {
        render(<ProfesionalPerfil p={BASE} cotizacion={desglosarTarifa(50_000, 10)} />);
        expect(screen.getByTestId("panel")).toBeTruthy();
        expect(screen.queryByTestId("segunda-cita-fuera-de-pi")).toBeNull();
        cleanup();
    });

    it("la tarifa del profesional se presenta como informativa (la red no la cobra)", () => {
        const { container } = render(<ProfesionalPerfil p={BASE} cotizacion={desglosarTarifa(50_000, 10)} />);
        // FORMA §b: la tarifa de la 2.ª cita se presenta como DIRECTA con el profesional; la red no la cobra.
        expect(container.textContent).toMatch(/directamente con el profesional/);
        expect(container.textContent).toMatch(/no la cobra Protección Infantil/);
        cleanup();
    });
});
