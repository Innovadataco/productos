import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MisReporteDetalle } from "./MisReporteDetalle";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

const DETALLE = {
    reporte: {
        id: "r1",
        identificador: "+573001112233",
        plataforma: "WhatsApp",
        ciudad: "Bogotá",
        pais: "Colombia",
        creadoEn: "2026-07-10T10:00:00.000Z",
        estadoVisual: "Procesado",
        badge: "success",
        enProceso: false,
    },
    clasificacion: {
        categoria: "SOLICITUD_MATERIAL",
        categoriaLabel: "Solicitud de material",
        confianza: 1,
        categoriasSecundarias: [{ categoria: "CONTACTO_INSISTENTE", score: 0.5 }],
    },
    votosModelos: [
        {
            modelo: "gemma2:27b",
            categorias: [
                { categoria: "SOLICITUD_MATERIAL", cumple: true, preguntasCumplidas: ["¿Alguien pide fotos?"] },
                { categoria: "CONTACTO_INSISTENTE", cumple: true, preguntasCumplidas: [] },
            ],
        },
        {
            modelo: "qwen2.5:14b",
            categorias: [
                { categoria: "SOLICITUD_MATERIAL", cumple: true, preguntasCumplidas: ["¿Alguien pide fotos?"] },
                { categoria: "CONTACTO_INSISTENTE", cumple: false, preguntasCumplidas: [] },
            ],
        },
    ],
    porcentajes: { SOLICITUD_MATERIAL: 1, CONTACTO_INSISTENTE: 0.5 },
    analisis:
        "Acuerdo total (2/2) en SOLICITUD_MATERIAL: supera el umbral de presencia. Acuerdo parcial (1/2) en CONTACTO_INSISTENTE: no alcanza el umbral.",
};

function mockFetchDetalle(body: unknown, ok = true, status = 200) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        status,
        json: async () => body,
    } as Response);
}

describe("MisReporteDetalle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza la matriz categorías × modelos con ✓/— y la columna de presencia", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText("+573001112233")).toBeTruthy();
        expect(screen.getByText("WhatsApp · Bogotá, Colombia")).toBeTruthy();
        expect(screen.getByText("Procesado")).toBeTruthy();

        // Filas con labels de categoría
        expect(screen.getAllByText("Solicitud de material").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Contacto insistente").length).toBeGreaterThan(0);

        // Columnas = modelos
        expect(screen.getByText("gemma2:27b")).toBeTruthy();
        expect(screen.getByText("qwen2.5:14b")).toBeTruthy();

        // Celdas: 3 ✓ (2 solicitud + 1 contacto) y 1 —
        expect(screen.getAllByLabelText(/: cumple$/)).toHaveLength(3);
        expect(screen.getAllByLabelText(/: no cumple$/)).toHaveLength(1);

        // Columna final de presencia
        expect(screen.getByText("100%")).toBeTruthy();
        expect(screen.getByText("50%")).toBeTruthy();
    });

    it("muestra la tarjeta de análisis con el texto de la plantilla", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText("Análisis")).toBeTruthy();
        expect(screen.getByText(/Acuerdo total \(2\/2\) en SOLICITUD_MATERIAL/)).toBeTruthy();
    });

    it("no usa la palabra 'riesgo' como etiqueta en ninguna parte", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);
        await screen.findByText("+573001112233");

        expect(screen.queryByText(/riesgo/i)).toBeNull();
    });

    it("reporte en proceso: mensaje informativo sin matriz", async () => {
        mockFetchDetalle({
            ...DETALLE,
            reporte: { ...DETALLE.reporte, estadoVisual: "En proceso", badge: "warning", enProceso: true },
            clasificacion: null,
            votosModelos: [],
            porcentajes: {},
            analisis: null,
        });
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText(/aún está en proceso/)).toBeTruthy();
        expect(screen.queryByText("Evaluación por categoría")).toBeNull();
    });
});
