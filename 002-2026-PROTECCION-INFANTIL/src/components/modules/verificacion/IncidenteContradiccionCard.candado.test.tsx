/**
 * SPEC-787 · CANDADO de render de la tarjeta del incidente (FORMA-SPEC753-INCIDENTE).
 *
 * El #1 del CEO: SIMÉTRICO — invertir quién dijo qué NO cambia el tono (si cambia, adjudicamos sin
 * datos). Además: «a favor del padre» SOLO con reloj legal; nada de «miente/reclamo/descargo»;
 * CERO rubí; el estado tardío/vencido se admite sin eufemismo.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { IncidenteContradiccionCard } from "@/components/modules/verificacion/IncidenteContradiccionCard";
import { copiaEstadoIncidente } from "@/components/modules/verificacion/copy-incidente-verificador";
import type { IncidenteBandejaDto, LadoRespuestaDto } from "@/lib/profesional/cita/bandeja-incidentes.service";

const lado = (rol: "PADRE" | "PROFESIONAL", seRealizo: boolean): LadoRespuestaDto => ({
    rol,
    seRealizo,
    operador: seRealizo ? "SI" : "NO_HUBO_OPERADOR",
    inicio: seRealizo ? "A_TIEMPO" : "NO_COMENZO",
    enlace: seRealizo ? "SI" : "NO_FUNCIONO",
    duracion: seRealizo ? "ENTRE_30_45" : null,
    respondidaEn: "2026-09-29T10:00:00.000Z",
});

const dto = (over: Partial<IncidenteBandejaDto> = {}): IncidenteBandejaDto => ({
    id: "inc1",
    solicitudId: "sol1",
    estado: "ABIERTO",
    incumplida: false,
    relojLegal: true,
    venceEn: "2026-10-15T00:00:00.000Z",
    quedanDiasHabiles: 5,
    preguntaDivergente: "SE_REALIZO",
    padreValor: "false",
    profesionalValor: "true",
    lados: [lado("PADRE", false), lado("PROFESIONAL", true)],
    ...over,
});

const claseCol = (c: HTMLElement, rol: string) => c.querySelector(`[data-lado="${rol}"]`)?.getAttribute("class") ?? "";

afterEach(() => cleanup());

describe("SPEC-787 · tarjeta del incidente (render simétrico)", () => {
    it("las dos columnas tienen el MISMO tono (estructuralmente simétricas)", () => {
        const { container } = render(<IncidenteContradiccionCard incidente={dto()} />);
        expect(claseCol(container, "PADRE")).toBe(claseCol(container, "PROFESIONAL"));
    });

    it("invertir quién dijo qué NO cambia el tono de la tarjeta (control positivo)", () => {
        const a = render(<IncidenteContradiccionCard incidente={dto({ lados: [lado("PADRE", false), lado("PROFESIONAL", true)] })} />).container;
        const tonoA = a.querySelector("[data-estado]")?.getAttribute("data-tono");
        const colA = claseCol(a, "PADRE");
        cleanup();
        const b = render(<IncidenteContradiccionCard incidente={dto({ lados: [lado("PADRE", true), lado("PROFESIONAL", false)] })} />).container;
        // Mismo tono de estado y mismas columnas: la pantalla no se inclina por quién dijo qué.
        expect(b.querySelector("[data-estado]")?.getAttribute("data-tono")).toBe(tonoA);
        expect(claseCol(b, "PADRE")).toBe(colA);
        expect(claseCol(b, "PROFESIONAL")).toBe(colA);
    });

    it("nunca adjudica ni usa rubí", () => {
        const { container } = render(<IncidenteContradiccionCard incidente={dto({ estado: "VENCIDO_A_FAVOR_PADRE" })} />);
        expect(/miente|falso|culpable|reclamo|descargo|sospechoso/i.test(container.textContent ?? "")).toBe(false);
        expect(container.innerHTML).not.toContain("rubi");
    });

    it("«a favor del padre» SOLO con reloj legal vencido; el interno vencido NO lo dice", () => {
        expect(copiaEstadoIncidente("VENCIDO_A_FAVOR_PADRE", true).texto).toMatch(/a favor del padre/i);
        expect(copiaEstadoIncidente("VENCIDO_A_FAVOR_PADRE", false).texto).not.toMatch(/a favor del padre/i);
        // los dos vencidos son ámbar, nunca rubí ni «resuelto»
        expect(copiaEstadoIncidente("VENCIDO_A_FAVOR_PADRE", true).tono).toBe("ambar");
        expect(copiaEstadoIncidente("RESUELTO_TARDE", true).texto).toMatch(/fuera del plazo/i);
    });
});
