/**
 * SPEC-159 (T003, FR-003): tests de la línea de tiempo del caso y de los
 * pendientes — puros (sin BD). Test por hito presente/ausente (SC-001): cada
 * hito cumplido trae su fecha real; el ausente queda pendiente con su estado
 * honesto, nunca inventado.
 */
import { describe, it, expect } from "vitest";
import { armarTimeline, calcularPendientes } from "./seguimiento";
import type { FuentesTimeline } from "./seguimiento";

const BASE = new Date("2026-08-07T10:00:00Z");
const DIA_MS = 24 * 60 * 60 * 1000;

function fuentesBase(): FuentesTimeline {
    return {
        alertaCreadoEn: BASE,
        hitosEstado: [
            { valorNuevo: JSON.stringify({ estado: "vista" }), creadoEn: new Date(BASE.getTime() + DIA_MS) },
            { valorNuevo: JSON.stringify({ estado: "gestionada" }), creadoEn: new Date(BASE.getTime() + 2 * DIA_MS) },
        ],
        avisos: [
            {
                tipoEvento: "REPORTE_NUEVO",
                estado: "ENVIADO",
                creadoEn: new Date(BASE.getTime() + 60_000),
                actualizadoEn: new Date(BASE.getTime() + 120_000),
            },
        ],
        match: { conteoAcumulado: 2, interCiudad: true, creadoEn: new Date(BASE.getTime() + 3_600_000) },
    };
}

function hito(timeline: ReturnType<typeof armarTimeline>, tipo: string) {
    const encontrado = timeline.find((h) => h.tipo === tipo);
    expect(encontrado, `falta el hito ${tipo}`).toBeDefined();
    return encontrado!;
}

describe("armarTimeline", () => {
    it("fixture completa: los 5 hitos cumplidos, ordenados asc por fecha real", () => {
        const timeline = armarTimeline(fuentesBase());

        expect(timeline).toHaveLength(5);
        expect(timeline.every((h) => h.estado === "cumplido")).toBe(true);

        const fechas = timeline.map((h) => h.fecha!);
        expect(fechas).toEqual([...fechas].sort());

        expect(hito(timeline, "detectado").fecha).toBe(BASE.toISOString());
        expect(hito(timeline, "corroborado").detalle).toContain("segundo reporte independiente");
        expect(hito(timeline, "corroborado").detalle).toContain("2 reportes acumulados");
        expect(hito(timeline, "avisado").fecha).toBe(new Date(BASE.getTime() + 120_000).toISOString());
        expect(hito(timeline, "vista").fecha).toBe(new Date(BASE.getTime() + DIA_MS).toISOString());
        expect(hito(timeline, "gestionada").fecha).toBe(new Date(BASE.getTime() + 2 * DIA_MS).toISOString());
    });

    it("sin match: corroborado queda pendiente, nunca inventado", () => {
        const timeline = armarTimeline({ ...fuentesBase(), match: null });
        const corroborado = hito(timeline, "corroborado");
        expect(corroborado.estado).toBe("pendiente");
        expect(corroborado.fecha).toBeNull();
        expect(corroborado.detalle).toContain("Aún no hay un segundo reporte");
    });

    it("el match agregado NO expone ciudades, denunciantes ni conductas (FR-009)", () => {
        const timeline = armarTimeline(fuentesBase());
        const texto = JSON.stringify(timeline);
        expect(texto).not.toContain("Bogotá");
        expect(texto).not.toContain("denunciante");
        expect(texto).not.toContain("conducta");
    });

    it("sin filas de audit: vista y gestionada pendientes (solo verdades)", () => {
        const timeline = armarTimeline({ ...fuentesBase(), hitosEstado: [] });
        expect(hito(timeline, "vista").estado).toBe("pendiente");
        expect(hito(timeline, "gestionada").estado).toBe("pendiente");
        // Los pendientes van al final, en orden canónico.
        const tipos = timeline.map((h) => h.tipo);
        expect(tipos.indexOf("vista")).toBeGreaterThan(tipos.indexOf("detectado"));
    });

    it("aviso OMITIDO: hito avisado honesto (desactivado en preferencias), nunca check falso", () => {
        const timeline = armarTimeline({
            ...fuentesBase(),
            avisos: [
                { tipoEvento: "REPORTE_NUEVO", estado: "OMITIDO", creadoEn: BASE, actualizadoEn: BASE },
            ],
        });
        const avisado = hito(timeline, "avisado");
        expect(avisado.estado).toBe("pendiente");
        expect(avisado.detalle).toContain("desactivado");
    });

    it("aviso PENDIENTE_DIGEST: hito avisado honesto (saldrá en el resumen)", () => {
        const timeline = armarTimeline({
            ...fuentesBase(),
            avisos: [
                { tipoEvento: "REPORTE_NUEVO", estado: "PENDIENTE_DIGEST", creadoEn: BASE, actualizadoEn: BASE },
            ],
        });
        const avisado = hito(timeline, "avisado");
        expect(avisado.estado).toBe("pendiente");
        expect(avisado.detalle).toContain("resumen");
    });

    it("aviso FALLIDO: hito avisado honesto (se reintentará)", () => {
        const timeline = armarTimeline({
            ...fuentesBase(),
            avisos: [
                { tipoEvento: "REPORTE_NUEVO", estado: "FALLIDO", creadoEn: BASE, actualizadoEn: BASE },
            ],
        });
        const avisado = hito(timeline, "avisado");
        expect(avisado.estado).toBe("pendiente");
        expect(avisado.detalle).toContain("reintentará");
    });

    it("sin registro de aviso: hito avisado pendiente", () => {
        const timeline = armarTimeline({ ...fuentesBase(), avisos: [] });
        expect(hito(timeline, "avisado").estado).toBe("pendiente");
    });

    it("valorNuevo corrupto no rompe la línea de tiempo", () => {
        const timeline = armarTimeline({
            ...fuentesBase(),
            hitosEstado: [{ valorNuevo: "{json roto", creadoEn: BASE }],
        });
        expect(hito(timeline, "vista").estado).toBe("pendiente");
        expect(hito(timeline, "detectado").estado).toBe("cumplido");
    });
});

describe("calcularPendientes", () => {
    it("alerta nueva sin notas: revisar + gestionar + registrar", () => {
        const pendientes = calcularPendientes({ estadoAlerta: "nueva", tieneNotas: false });
        expect(pendientes.map((p) => p.clave)).toEqual(["revisar", "gestionar", "registrar"]);
    });

    it("alerta vista sin notas: gestionar + registrar", () => {
        const pendientes = calcularPendientes({ estadoAlerta: "vista", tieneNotas: false });
        expect(pendientes.map((p) => p.clave)).toEqual(["gestionar", "registrar"]);
    });

    it("alerta gestionada sin notas: solo registrar", () => {
        const pendientes = calcularPendientes({ estadoAlerta: "gestionada", tieneNotas: false });
        expect(pendientes.map((p) => p.clave)).toEqual(["registrar"]);
    });

    it("caso al día (gestionada + nota): sin pendientes", () => {
        expect(calcularPendientes({ estadoAlerta: "gestionada", tieneNotas: true })).toHaveLength(0);
    });
});
