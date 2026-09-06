/**
 * SPEC-558 (I-345) · CANDADO: a confianza 0 el detalle NO presenta «Otro» como
 * una categoría — muestra un estado destacado «Sin determinación» (el jurado no
 * llegó a una categoría; va a revisión manual). La DIFERENCIA DE TRATAMIENTO es
 * el arreglo: ámbar (atención), NUNCA rubí, y NO el par «Categoría: … · Confianza:
 * 0.0%» que un operador cansado lee como clasificación real. Con confianza > 0 el
 * bloque normal no cambia.
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReporteDetalleInfo } from "./ReporteDetalleInfo";
import type { DetalleReporte } from "./types";

function reporteCon(confianza: number, categoria = "OTRO"): DetalleReporte {
    return {
        id: "r1",
        identificador: "+57300",
        plataforma: { nombre: "WhatsApp", clave: "whatsapp" },
        texto: "…",
        estado: "REVISION_MANUAL",
        ciudad: "Bogotá",
        pais: "Colombia",
        fechaIncidente: "2026-07-10T10:00:00Z",
        esAnonimo: false,
        numeroSeguimiento: "RPT-558",
        creadoEn: "2026-07-10T12:00:00Z",
        prioridadAlta: false,
        keywordsDetectadas: [],
        esRafaga: false,
        eliminado: false,
        motivoBaja: null,
        notaBaja: null,
        eliminadoEn: null,
        clasificacion: {
            categoria,
            confianza,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            correccion: null,
        },
    };
}

describe("SPEC-558 · confianza 0 = «Sin determinación», no una categoría", () => {
    it("confianza 0: estado destacado en ámbar, sin el par categoría/confianza, sin rubí", () => {
        const { container } = render(<ReporteDetalleInfo reporte={reporteCon(0)} />);
        expect(screen.getByText("Sin determinación")).toBeTruthy();
        expect(screen.getByText(/El jurado no llegó a una categoría/)).toBeTruthy();
        expect(screen.getByText(/revisión manual/)).toBeTruthy();
        // NO se presenta «Otro» como categoría real ni «Confianza: 0.0%».
        expect(screen.queryByText(/Categoría:/)).toBeNull();
        expect(screen.queryByText(/Confianza:/)).toBeNull();
        // Atención (ámbar), NUNCA criticidad (rubí).
        const bloque = screen.getByText("Sin determinación").closest("div");
        expect(bloque?.className).toContain("bg-ambar/10");
        expect(container.innerHTML).not.toContain("rubi");
    });

    it("confianza > 0: el bloque normal NO cambia (categoría + confianza visibles)", () => {
        render(<ReporteDetalleInfo reporte={reporteCon(0.8, "EXTORSION")} />);
        expect(screen.getByText(/Categoría:/)).toBeTruthy();
        expect(screen.getByText(/Confianza:/)).toBeTruthy();
        expect(screen.getByText(/80\.0%/)).toBeTruthy();
        expect(screen.queryByText("Sin determinación")).toBeNull();
    });
});
