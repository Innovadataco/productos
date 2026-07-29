import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MisReporteDetalle } from "./MisReporteDetalle";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

/**
 * Contrato spec 116: la API del padre entrega SOLO las conductas confirmadas
 * (las que superaron el umbral en el motor) y un mensaje en lenguaje humano
 * construido con plantillas deterministas. La traza técnica (modelos, votos,
 * porcentajes, umbrales, categorías descartadas) vive solo en el expediente
 * del admin (spec 096, D-22) y nunca llega a esta vista.
 */
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
        conductas: [
            { categoria: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
            { categoria: "CONTACTO_INSISTENTE", label: "Contacto insistente" },
        ],
        mensaje:
            "Revisamos el caso y encontramos posibles solicitudes de fotos o videos íntimos dirigidas a un menor y posible contacto insistente que genera incomodidad.\n\nTe recomendamos:\n- No respondas a la solicitud ni envíes material íntimo, y conserva los mensajes como evidencia.\n- Bloquea el contacto en la plataforma y conserva el registro de los mensajes recibidos.",
    },
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

    it("muestra al padre solo lo suyo: datos del reporte y conductas confirmadas", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText("+573001112233")).toBeTruthy();
        expect(screen.getByText("WhatsApp · Bogotá, Colombia")).toBeTruthy();
        expect(screen.getByText("Procesado")).toBeTruthy();

        // Conductas confirmadas, en lenguaje humano.
        expect(screen.getByText("Conductas identificadas:")).toBeTruthy();
        expect(screen.getByText("Solicitud de material")).toBeTruthy();
        expect(screen.getByText("Contacto insistente")).toBeTruthy();
    });

    it("explica qué significa eso con la plantilla determinista", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText("Qué significa esto")).toBeTruthy();
        expect(screen.getByText(/posibles solicitudes de fotos o videos íntimos/)).toBeTruthy();
        expect(screen.getByText(/Bloquea el contacto en la plataforma/)).toBeTruthy();
    });

    it("muestra los canales oficiales de denuncia", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText("Canales oficiales de denuncia")).toBeTruthy();
        expect(screen.getByText("Línea 141")).toBeTruthy();
        expect(screen.getByText("CAI Virtual")).toBeTruthy();
        expect(screen.getByText("Te Protejo")).toBeTruthy();
    });

    it("NO muestra nada técnico: modelos, votos, porcentajes, umbrales ni análisis", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);
        await screen.findByText("+573001112233");

        expect(screen.queryByText(/gemma|qwen|aya|llama|mistral|deepseek/i)).toBeNull();
        expect(screen.queryByText(/modelo/i)).toBeNull();
        expect(screen.queryAllByText(/%/).length).toBe(0);
        expect(screen.queryByText(/votos?/i)).toBeNull();
        expect(screen.queryByText(/umbral/i)).toBeNull();
        expect(screen.queryByText(/presencia/i)).toBeNull();
        expect(screen.queryByText(/evaluación por categoría/i)).toBeNull();
        expect(screen.queryByText(/^Análisis$/)).toBeNull();
    });

    it("sin conductas confirmadas: texto institucional neutro, sin acusaciones", async () => {
        mockFetchDetalle({
            ...DETALLE,
            clasificacion: {
                conductas: [],
                mensaje: "Revisamos el caso y no encontramos conductas concretas que describir en este momento.",
            },
        });
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText(/no encontramos conductas concretas/)).toBeTruthy();
        expect(screen.queryByText("Conductas identificadas:")).toBeNull();
        // Los canales siguen visibles aunque no haya hallazgos.
        expect(screen.getByText("Línea 141")).toBeTruthy();
    });

    it("no usa la palabra 'riesgo' como etiqueta en ninguna parte", async () => {
        mockFetchDetalle(DETALLE);
        render(<MisReporteDetalle reporteId="r1" />);
        await screen.findByText("+573001112233");

        expect(screen.queryByText(/riesgo/i)).toBeNull();
    });

    it("reporte en proceso: mensaje informativo sin clasificación", async () => {
        mockFetchDetalle({
            ...DETALLE,
            reporte: { ...DETALLE.reporte, estadoVisual: "En proceso", badge: "warning", enProceso: true },
            clasificacion: null,
        });
        render(<MisReporteDetalle reporteId="r1" />);

        expect(await screen.findByText(/aún está en proceso/)).toBeTruthy();
        expect(screen.queryByText("Qué significa esto")).toBeNull();
        expect(screen.queryByText("Conductas identificadas:")).toBeNull();
    });
});
