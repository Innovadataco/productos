import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReporteDetalleSoloLectura } from "./ReporteDetalleSoloLectura";

// SPEC-595: el detalle de un reporte procesado se consulta en modal solo-lectura
// con la estructura de campos pedida por el dueño y sin acciones EDITABLES.
// SPEC-734: el relato arranca oculto también acá; se permite «Revelar texto» (una
// LECTURA auditada, no una edición) — el resto de acciones (clasificar, corregir,
// anonimizar, escalar, dar de baja, validar) sigue prohibido en la consulta.

const detalle = {
    id: "reporte-123",
    identificador: "+57300TEST000",
    numeroSeguimiento: "RPT-SOLO001",
    estado: "CORREGIDO",
    esAnonimo: false,
    prioridadAlta: false,
    keywordsDetectadas: [],
    esRafaga: false,
    eliminado: false,
    motivoBaja: null,
    notaBaja: null,
    eliminadoEn: null,
    creadoEn: "2026-07-10T10:00:00Z",
    fechaIncidente: "2026-07-10T10:00:00Z",
    ciudad: "Bogotá",
    pais: "Colombia",
    plataforma: { nombre: "WhatsApp", clave: "whatsapp" },
    texto: "Texto anonimizado del reporte.",
    clasificacion: {
        categoria: "EXTORSION",
        confianza: 0.9,
        contienePii: false,
        piiDetectada: [],
        modeloUsado: "ornith:9b",
        latenciaMs: 1200,
        categoriasSecundarias: [],
        posibleAgresorPar: false,
        correccion: {
            categoriaOriginal: "CONTACTO_INSISTENTE",
            categoriaCorregida: "EXTORSION",
            motivo: "Reclasificación por operador",
            creadoEn: "2026-07-10T11:00:00Z",
        },
    },
    reintentos: [
        {
            id: "reintento-1",
            intento: 1,
            exitoso: false,
            error: "Ollama no disponible",
            creadoEn: "2026-07-10T10:02:00Z",
        },
        {
            id: "reintento-2",
            intento: 2,
            exitoso: true,
            error: null,
            creadoEn: "2026-07-10T10:05:00Z",
        },
    ],
};

function mockDetalleFetch() {
    return vi.spyOn(global, "fetch").mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ reporte: detalle }),
    }) as Response);
}

describe("ReporteDetalleSoloLectura", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra la estructura de campos del detalle procesado y el aviso de solo visualización", async () => {
        mockDetalleFetch();

        render(<ReporteDetalleSoloLectura reporteId="reporte-123" onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText("Detalle del reporte — solo visualización")).toBeTruthy();
        });

        expect(screen.getByText(/no permite clasificar, corregir ni modificar/i)).toBeTruthy();
        expect(screen.getByText("Número de seguimiento")).toBeTruthy();
        expect(screen.getByText("RPT-SOLO001")).toBeTruthy();
        expect(screen.getByText("Estado")).toBeTruthy();
        expect(screen.getByText("Plataforma")).toBeTruthy();
        expect(screen.getByText("Identificador")).toBeTruthy();
        expect(screen.getByText("Ubicación")).toBeTruthy();
        expect(screen.getByText("Fecha del incidente")).toBeTruthy();
        expect(screen.getByText("Origen")).toBeTruthy();
        expect(screen.getByText("Recibido")).toBeTruthy();
        expect(screen.getByText("Clasificación IA")).toBeTruthy();
        expect(screen.getByText("Historial de intentos de procesamiento")).toBeTruthy();
        // Corrección registrada del caso procesado.
        expect(screen.getByText("Corrección registrada")).toBeTruthy();
    });

    it("no ofrece acciones EDITABLES (pero sí «Revelar texto», que es una lectura auditada)", async () => {
        mockDetalleFetch();

        render(<ReporteDetalleSoloLectura reporteId="reporte-123" onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText("RPT-SOLO001")).toBeTruthy();
        });

        // SPEC-734: el relato NO se pinta por defecto — marcador + «Revelar texto».
        expect(screen.getByText(/El texto queda oculto; al revelarlo se registra quién lo vio/)).toBeTruthy();
        const revelar = screen.getByRole("button", { name: /Revelar texto/ });
        expect(revelar).toBeTruthy();

        // Ninguna acción EDITABLE (mutación del caso). «Revelar texto» es LECTURA
        // auditada, no edición: se excluye de la lista prohibida a propósito. No hay
        // «Revelar original» acá (la consulta no ofrece la evidencia original).
        const nombresProhibidos = [/confirmar/i, /corregir/i, /anonimizar/i, /escalar/i, /dar de baja/i, /validar/i, /revelar original/i];
        const botones = screen.getAllByRole("button");
        for (const boton of botones) {
            for (const nombre of nombresProhibidos) {
                expect(boton.textContent).not.toMatch(nombre);
            }
        }
    });

    it("muestra error y reintento cuando el detalle no carga", async () => {
        vi.spyOn(global, "fetch").mockImplementation(async () => ({
            ok: false,
            status: 500,
            json: async () => ({}),
        }) as Response);

        render(<ReporteDetalleSoloLectura reporteId="reporte-123" onClose={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText("No se encontró el reporte")).toBeTruthy();
        });
        expect(screen.getAllByText("Cerrar").length).toBeGreaterThan(0);
    });
});
