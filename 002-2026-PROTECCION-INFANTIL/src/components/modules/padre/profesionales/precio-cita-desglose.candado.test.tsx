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
import { MENSAJE_TOTAL_CAMBIO } from "@/lib/profesional/cita/cotizacion-cita";
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
        // FORMA 24ed7aa1 §1: tres renglones; la cifra GRANDE es «Total a pagar» (no la consulta — el defecto).
        expect(screen.getByText("Valor de la consulta")).toBeTruthy();
        expect(screen.getByText("Servicio de la red (10 %)")).toBeTruthy();
        expect(screen.getByText("Total a pagar")).toBeTruthy();
        expect(screen.getByTestId("desglose-total").className).toMatch(/text-2xl/);
        cleanup();
    });

    it("(1) control POSITIVO: cambiar la comisión cambia lo que ve el padre", () => {
        render(<ProfesionalPerfil p={BASE} cotizacion={desglosarTarifa(50_000, 15)} />);
        expect(screen.getByTestId("desglose-total").textContent).toBe(formatearCOP(57_500));
        // El % sale del parámetro: nunca un «10» quemado en el rótulo.
        expect(screen.getByText("Servicio de la red (15 %)")).toBeTruthy();
        expect(screen.queryByText("Servicio de la red (10 %)")).toBeNull();
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

    it("(3b) el panel de espera pinta el desglose GUARDADO (no recalcula) y su rótulo sigue al pago", () => {
        const panel = leer("src/components/modules/padre/citas/EsperaCitaPanel.tsx");
        expect(panel).toMatch(/rotuloTotal=\{etiquetaMontoCita\(cita\.pagoAprobadoEn\)\}/);
        expect(panel).toMatch(/desgloseDeCitaGuardada\(/);
        const dto = leer("src/lib/profesional/cita/dto.ts");
        expect(dto).toMatch(/montoConsulta: solicitud\.montoConsulta/);
        expect(dto).toMatch(/montoServicio: solicitud\.montoServicio/);
        expect(dto).toMatch(/porcentajeServicio: solicitud\.porcentajeServicio/);
        // El componente NO calcula: ni Math.round ni porcentajes propios.
        const comp = leer("src/components/modules/padre/profesionales/DesgloseCostoCita.tsx");
        expect(comp).not.toMatch(/Math\.round|\/\s*100/);
    });

    it("(3c) FORMA §3-bis: el aviso del 409 por precio es ÁMBAR, SOBRE el desglose, y solo para ese 409", () => {
        const panel = leer("src/components/modules/padre/profesionales/SolicitarCitaPanel.tsx");
        // Copy de Diseño (texto invariante del aviso).
        expect(MENSAJE_TOTAL_CAMBIO).toContain("No se creó la cita ni se hizo ningún cobro");
        // El aviso usa el mensaje de Diseño en una caja ÁMBAR (no rubí).
        const bloque = panel.slice(panel.indexOf("avisoPrecioCambio && !esReasignacion"), panel.indexOf("Total a pagar — lo que más pesa"));
        expect(bloque).toMatch(/bg-ambar/);
        expect(bloque).not.toMatch(/estado-rubi/);
        expect(bloque).toMatch(/\{MENSAJE_TOTAL_CAMBIO\}/);
        // SOBRE el desglose recargado del MODAL (identificado por su comentario), no el preview del panel.
        expect(panel.indexOf("avisoPrecioCambio && !esReasignacion")).toBeLessThan(panel.indexOf("Total a pagar — lo que más pesa"));
        // Solo para el 409 de precio (no el de franja tomada): la rama lo discrimina por el mensaje.
        expect(panel).toMatch(/res\.status === 409 && json\.error\?\.message === MENSAJE_TOTAL_CAMBIO/);
    });
});
