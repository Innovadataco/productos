/**
 * CANDADO · SPEC-934 (I-450) — el padre ve el TOTAL que se guarda y se cobra; «pagado» solo con pago aprobado.
 *
 *   (1) La ficha pinta como cifra principal `cotizacion.pagaElPadre` (consulta + servicio de la red) y el
 *       desglose suma; control POSITIVO: otra comisión → otra cifra (la pantalla sigue a la cotización).
 *       Antes pintaba solo el precio de la consulta (50.000 en vez de 55.000).
 *   (2) El modal envía `totalEsperado = cotizacion.pagaElPadre` (lo que el padre aceptó) y la creación usa
 *       `desglosarTarifa` (sin copia de la fórmula) — la conducta servidor↔pantalla la amarra
 *       `src/app/api/padre/citas/precio-desglose.candado.test.ts` contra la BD.
 *   (3) «Monto pagado» SOLO con `pagoAprobadoEn`; pendiente → «Total a pagar».
 */
import * as fs from "node:fs";
import * as path from "node:path";
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
import { formatearCOP } from "./DesgloseCostoCita";
import { desglosarTarifa } from "@/lib/profesional/cita/comision";
import { etiquetaMontoCita } from "@/components/modules/padre/citas/EsperaCitaPanel";

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

const RAIZ = path.resolve(__dirname, "../../../../..");
const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf-8");

describe("SPEC-934 · precio de la cita: total con servicio, desglose y «pagado» honesto", () => {
    it("(1) la ficha muestra el TOTAL (55.000) y el desglose suma: consulta + servicio = total", () => {
        const cot = desglosarTarifa(50_000, 10);
        const { container } = render(<ProfesionalPerfil p={BASE} cotizacion={cot} />);
        expect(cot.pagaElPadre).toBe(55_000);
        expect(screen.getByTestId("desglose-total").textContent).toBe(formatearCOP(55_000));
        const texto = container.textContent ?? "";
        expect(texto).toContain(formatearCOP(50_000)); // consulta
        expect(texto).toContain(formatearCOP(5_000)); // servicio de la red
        // La cifra GRANDE es el total, no la consulta (el defecto).
        const grande = container.querySelector("p.text-3xl");
        expect(grande?.textContent).toBe(formatearCOP(55_000));
        cleanup();
    });

    it("(1) control POSITIVO: cambiar la comisión cambia lo que ve el padre", () => {
        const { container } = render(<ProfesionalPerfil p={BASE} cotizacion={desglosarTarifa(50_000, 15)} />);
        expect(container.querySelector("p.text-3xl")?.textContent).toBe(formatearCOP(57_500));
        expect(screen.getByTestId("desglose-total").textContent).toBe(formatearCOP(57_500));
        cleanup();
    });

    it("(2) el modal envía el total aceptado y la creación no copia la fórmula", () => {
        expect(leer("src/components/modules/padre/profesionales/SolicitarCitaPanel.tsx")).toMatch(
            /totalEsperado:\s*cotizacion\.pagaElPadre/,
        );
        const servicio = leer("src/lib/profesional/cita/cita.service.ts");
        expect(servicio).toMatch(/desglosarTarifa\(/);
        expect(servicio, "copia de la fórmula de comisión fuera de desglosarTarifa").not.toMatch(/\*\s*porcentajeServicio\)\s*\/\s*100/);
    });

    it("(3) «Monto pagado» SOLO con el pago aprobado; pendiente → «Total a pagar»", () => {
        expect(etiquetaMontoCita(null)).toBe("Total a pagar");
        expect(etiquetaMontoCita("2026-11-19T10:00:00.000Z")).toBe("Monto pagado");
        const panel = leer("src/components/modules/padre/citas/EsperaCitaPanel.tsx");
        expect(panel).toMatch(/etiquetaMontoCita\(cita\.pagoAprobadoEn\)/);
        // Ningún «Monto pagado» literal en el JSX (solo dentro del helper).
        expect(panel.match(/>\s*Monto pagado\s*</g) ?? []).toEqual([]);
    });
});
