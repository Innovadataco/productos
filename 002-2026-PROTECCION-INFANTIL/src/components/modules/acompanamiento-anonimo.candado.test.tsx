/**
 * CANDADO · SPEC-736 — el acompañamiento a quien reporta ANÓNIMO. La pantalla de
 * seguimiento, cuando el reporte ya está clasificado, muestra además de las
 * conductas: (1) mensaje de calma → (2) acciones por conducta → (3) canales.
 *
 * Conducta (no fuente): se renderiza `SeguimientoClient` con un payload real
 * (acompañamiento armado por el MOTOR real `construirAcompanamientoAnonimo`) y se
 * afirma el contrato de Diseño (FORMA-SPEC736 §5/§72-75):
 *  1. calma + acción de EXTORSION («No cedas a las exigencias…») + los tres canales;
 *  2. NADA de «tu hijo» (audiencia anónima: rol desconocido) — control positivo:
 *     las reencuadradas DOXING/SOLICITUD_ENCUENTRO/GENÉRICA no dicen «tu hijo»;
 *  3. NINGÚN guardrail roto: «investigaremos», «el equipo revisará», «recibirás
 *     respuesta», score/nivel — el sistema no promete conducta no verificada.
 *  4. Clasificado SIN conductas de riesgo visibles: igual muestra calma + canales,
 *     pero NO la lista «Lo que puedes hacer».
 *
 * Control positivo: si la pantalla dejara de renderear el acompañamiento (o el
 * builder dejara de reencuadrar), (1)/(2) caen. Verificado por mutación.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { SeguimientoClient } from "./SeguimientoClient";
import {
    construirAcompanamientoAnonimo,
    PLANTILLAS_DEFECTO,
    REENCUADRE_ANONIMO_DEFECTO,
} from "@/lib/expediente/mensaje-padre";

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => ({ get: (k: string) => (k === "numero" ? "RPT-TEST01" : null) }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => cleanup());

function payload(conductas: string[]) {
    const [categoria, ...secundarias] = conductas;
    const acompanamiento = construirAcompanamientoAnonimo(conductas, PLANTILLAS_DEFECTO, REENCUADRE_ANONIMO_DEFECTO);
    return {
        numeroSeguimiento: "RPT-TEST01",
        estadoVisual: "Procesado",
        estadoInterno: "CLASIFICADO",
        badge: "success",
        enProceso: false,
        mensaje: "Tu reporte fue procesado.",
        slaHoras: 48,
        creadoEn: "2026-09-20T10:00:00.000Z",
        actualizadoEn: "2026-09-21T10:00:00.000Z",
        identificador: "cuenta_test",
        plataforma: "Roblox",
        clasificacion: {
            categoria: categoria ?? "OTRO",
            categoriaLabel: categoria ?? "Otro",
            categoriaGrupo: "Grupo",
            categoriasSecundarias: secundarias,
            contienePii: false,
        },
        actividad: null,
        ranking: null,
        acompanamiento,
        otrosReportes: null,
    };
}

function mockResponse(body: unknown) {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response);
}

describe("SPEC-736 · acompañamiento al reportante anónimo (pantalla de seguimiento)", () => {
    it("clasificado con EXTORSION+DOXING: calma + acción de extorsión + los tres canales", async () => {
        mockResponse(payload(["EXTORSION", "DOXING"]));
        render(<SeguimientoClient />);

        await screen.findByText("Hiciste bien en reportar.");
        // (2) acción por conducta (EXTORSION, «= igual» en ambas audiencias)
        expect(screen.getByText(/No cedas a las exigencias/)).toBeTruthy();
        // (3) los tres canales oficiales
        expect(screen.getByText("Línea 141")).toBeTruthy();
        expect(screen.getByText("CAI Virtual")).toBeTruthy();
        expect(screen.getByText("Te Protejo")).toBeTruthy();
    });

    it("guardrails: nunca «tu hijo», ni promesas de conducta del sistema, ni score", async () => {
        mockResponse(payload(["DOXING", "SOLICITUD_ENCUENTRO", "OFRECIMIENTO_REGALOS", "CATEGORIA_INVENTADA"]));
        const { container } = render(<SeguimientoClient />);

        await screen.findByText("Hiciste bien en reportar.");
        const texto = container.textContent ?? "";
        expect(texto).not.toContain("tu hijo");
        expect(texto).not.toMatch(/investigaremos|el equipo revisar[aá]|recibir[aá]s respuesta|score|nivel de riesgo/i);
        // la reencuadrada genérica sí habla de «la persona afectada»
        expect(texto).toContain("la persona afectada");
    });

    it("clasificado SIN conductas de riesgo (solo SPAM/OTRO → acciones vacías): calma + canales, sin lista de acciones", async () => {
        // El servicio filtra SPAM/OTRO antes de armar el acompañamiento → acciones vacías.
        const body = payload([]);
        mockResponse(body);
        render(<SeguimientoClient />);

        await screen.findByText("Hiciste bien en reportar.");
        expect(screen.queryByText("Lo que puedes hacer:")).toBeNull();
        // Los canales igual acompañan.
        expect(screen.getByText("Línea 141")).toBeTruthy();
    });

    it("en proceso (sin acompañamiento): no muestra la calma", async () => {
        const body = { ...payload(["EXTORSION"]), estadoVisual: "En proceso", enProceso: true, badge: "warning", clasificacion: null, acompanamiento: null };
        mockResponse(body);
        render(<SeguimientoClient />);

        await waitFor(() => expect(screen.getByText("cuenta_test")).toBeTruthy());
        expect(screen.queryByText("Hiciste bien en reportar.")).toBeNull();
    });
});
