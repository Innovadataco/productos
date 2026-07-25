import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AdminReporteExpediente } from "./AdminReporteExpediente";

function mockFetchExpediente(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        status: ok ? 200 : 500,
        json: async () => response,
    } as Response);
}

function etapaBase(overrides: Record<string, unknown> = {}) {
    return {
        orden: 1,
        fase: "A",
        faseNombre: "Ingesta",
        clave: "recepcion",
        nombre: "Recepción",
        icono: "inbox",
        capa: 1,
        actividad: "Actividad de prueba",
        evaluacion: "Evaluación de prueba",
        fechaHora: "2026-07-10T10:00:00Z",
        campos: { numeroSeguimiento: "RPT-TEST001" },
        gated: false,
        sinInstrumentar: false,
        ...overrides,
    };
}

const ETAPAS = [
    etapaBase({ orden: 1, fase: "A", faseNombre: "Ingesta", clave: "recepcion", nombre: "Recepción" }),
    etapaBase({ orden: 2, fase: "A", faseNombre: "Ingesta", clave: "peso_fuente", nombre: "Peso de fuente" }),
    etapaBase({ orden: 3, fase: "B", faseNombre: "Preparación", clave: "embedding", nombre: "Embedding" }),
    etapaBase({
        orden: 4, fase: "B", faseNombre: "Preparación", clave: "deduplicacion", nombre: "Deduplicación",
        capa: 2, sinInstrumentar: true, campos: {},
    }),
    etapaBase({ orden: 5, fase: "B", faseNombre: "Preparación", clave: "guardas", nombre: "Guardas baratas", capa: 2 }),
    etapaBase({ orden: 6, fase: "C", faseNombre: "Evaluación", clave: "contexto_rag", nombre: "Contexto RAG", capa: 2 }),
    etapaBase({ orden: 7, fase: "C", faseNombre: "Evaluación", clave: "clasificacion", nombre: "Clasificación por rúbrica" }),
    etapaBase({ orden: 8, fase: "D", faseNombre: "Cierre", clave: "anonimizacion", nombre: "Anonimización PII", gated: true }),
    etapaBase({ orden: 9, fase: "D", faseNombre: "Cierre", clave: "decision", nombre: "Decisión", capa: 2 }),
    etapaBase({ orden: 10, fase: "D", faseNombre: "Cierre", clave: "finalizacion", nombre: "Finalización" }),
];

function expedienteBase(overrides: Record<string, unknown> = {}) {
    return {
        reporte: {
            id: "reporte-123",
            numeroSeguimiento: "RPT-TEST001",
            estado: "CLASIFICADO",
            creadoEn: "2026-07-10T10:00:00Z",
            plataforma: "WhatsApp",
            pais: "Colombia",
            ciudad: "Bogotá",
            esAnonimo: true,
        },
        etapas: ETAPAS,
        clasificacion: {
            categorias: ["OFRECIMIENTO_REGALOS"],
            confianza: 0.85,
            usoCascada: false,
            modeloCascada: null,
            latenciaMs: 1200,
            promptTokens: 100,
            responseTokens: 20,
            matriz: { OFRECIMIENTO_REGALOS: { "ornith:9b": 1, "gemma:4b": 0 } },
            detallePorCategoria: [
                {
                    categoria: "OFRECIMIENTO_REGALOS",
                    preguntas: [
                        {
                            texto: "¿Se ofrece dinero o regalos?",
                            tipo: "decisiva",
                            votosPorModelo: { "ornith:9b": 1, "gemma:4b": 0 },
                        },
                        {
                            texto: "¿La conversación es reciente?",
                            tipo: "contexto",
                            votosPorModelo: { "ornith:9b": 1, "gemma:4b": 1 },
                        },
                    ],
                },
            ],
        },
        sintesis: {
            analisisInterno: "Consenso 1/2 en OFRECIMIENTO_REGALOS.",
            mensajePadre: "[BORRADOR] Se registró un reporte sobre el identificador consultado.",
        },
        revelado: false,
        puedeRevelar: true,
        ...overrides,
    };
}

describe("AdminReporteExpediente", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza las 10 etapas con sus fases", async () => {
        mockFetchExpediente(expedienteBase());

        render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Recepción")).toBeTruthy();
        });

        for (const nombre of [
            "Recepción", "Peso de fuente", "Embedding", "Deduplicación", "Guardas baratas",
            "Contexto RAG", "Clasificación por rúbrica", "Anonimización PII", "Decisión", "Finalización",
        ]) {
            expect(screen.getByText(nombre)).toBeTruthy();
        }
        expect(screen.getByText("Fase A — Ingesta")).toBeTruthy();
        expect(screen.getByText("Fase D — Cierre")).toBeTruthy();
    });

    it("marca las etapas sin instrumentar", async () => {
        mockFetchExpediente(expedienteBase());

        render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Sin instrumentar")).toBeTruthy();
        });
    });

    it("oculta los campos gated cuando revelado es false", async () => {
        const etapas = ETAPAS.map((e) =>
            e.clave === "anonimizacion"
                ? { ...e, gated: true, campos: { contienePii: true } }
                : e
        );
        mockFetchExpediente(expedienteBase({ etapas, revelado: false }));

        render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Campos restringidos")).toBeTruthy();
        });
        expect(screen.queryByText("textoOriginal")).toBeNull();
    });

    it("el mensaje al padre se muestra como borrador y sin score", async () => {
        mockFetchExpediente(expedienteBase());

        render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Mensaje al padre")).toBeTruthy();
        });
        expect(screen.getByText("Borrador de revisión")).toBeTruthy();
        const mensaje = screen.getByText(/\[BORRADOR\]/);
        expect(mensaje.textContent).not.toMatch(/score|riesgo|confianza/i);
    });

    it("muestra la votación pregunta por pregunta con tipo y votos por modelo", async () => {
        mockFetchExpediente(expedienteBase());

        render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("¿Se ofrece dinero o regalos?")).toBeTruthy();
        });
        expect(screen.getByText("Decisiva")).toBeTruthy();
        expect(screen.getByText("Contexto")).toBeTruthy();
        expect(screen.getByText("Confianza 85%")).toBeTruthy();
    });

    it("el botón Revelar original solo aparece con puedeRevelar y dispara el fetch con revelar=true", async () => {
        const fetchMock = vi.spyOn(global, "fetch");
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => expedienteBase({ puedeRevelar: false }),
        } as Response);

        const { unmount } = render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Recepción")).toBeTruthy();
        });
        expect(screen.queryByText("Revelar original")).toBeNull();
        unmount();

        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => expedienteBase({ puedeRevelar: true }),
        } as Response);
        render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        const boton = await screen.findByText("Revelar original");
        fireEvent.click(boton);

        await waitFor(() => {
            const llamadasRevelar = fetchMock.mock.calls.filter(
                ([url]) => typeof url === "string" && url.includes("revelar=true")
            );
            expect(llamadasRevelar.length).toBe(1);
        });
    });

    it("muestra mensaje de error seguro cuando el endpoint falla", async () => {
        mockFetchExpediente({ error: { message: "Error interno", code: "INTERNAL_ERROR" } }, false);

        render(<AdminReporteExpediente reporteId="reporte-123" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByRole("alert").textContent).toContain("Error interno");
        });
    });
});
