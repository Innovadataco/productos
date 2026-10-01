/**
 * CANDADO · SPEC-792 C2 (la que importa) — desde «Esta cita ya pasó» de una cita no ocurrida, el PRIMER
 * camino ofrecido es la ENCUESTA; NO se ofrece [Pedir otra cita] en paralelo.
 *
 * El defecto: «ya pasó» ofrecía [Pedir otra cita] sin mencionar la encuesta, así que el padre al que no
 * le prestaron el servicio —el que el motor de contradicciones MÁS necesita— reprogramaba sin responder
 * nunca. Era una vía de escape del motor, desde la pantalla que existe para atenderlo.
 *
 * Control positivo por MUTACIÓN: con una encuesta pendiente, la tarjeta «Contar cómo me fue» está, y en
 * la pantalla NO hay un [Pedir otra cita] paralelo. Si alguien reintroduce esa oferta, el candado cae.
 * Unit (jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import { EsperaCitaPanel } from "./EsperaCitaPanel";

const AYER = new Date(Date.now() - 24 * 60 * 60 * 1000);

const citaConfirmadaPasada: CitaParaPadreDto = {
    id: "cita-1",
    estado: "CONFIRMADA",
    urgencia: "SIN_APURO",
    creadoEn: AYER.toISOString(),
    venceEn: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    pagoAprobadoEn: AYER.toISOString(),
    montoTotal: 100000,
    profesional: { id: "p1", nombreVisible: "Dra. Pública", tituloProfesional: "Psicóloga", ciudad: { id: "c1", nombre: "Bogotá" } },
    franja: { inicio: AYER.toISOString(), fin: new Date(AYER.getTime() + 60 * 60 * 1000).toISOString(), modalidad: "VIRTUAL" },
    solicitudPreviaId: null,
    pagoHeredadoDeId: null,
    expedienteCompartidoId: null,
    // Enlace publicado y luego pasó (NO es el sub-caso C4 de «nunca publicado»): «ya pasó» normal.
    enlace: { estado: "PASADA" },
};

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            // La tarjeta de la encuesta pregunta /api/encuesta: esta cita está pendiente.
            if (url.includes("/api/encuesta")) {
                return new Response(
                    JSON.stringify({ data: { pendientes: [{ solicitudId: "cita-1", franjaInicio: AYER.toISOString() }] } }),
                    { status: 200 },
                );
            }
            return new Response(JSON.stringify({ data: null }), { status: 200 });
        }),
    );
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("SPEC-792 C2 · «ya pasó» no eclipsa la encuesta", () => {
    it("con la encuesta pendiente, se ofrece «Contar cómo me fue» y NO hay [Pedir otra cita] paralelo", async () => {
        render(<EsperaCitaPanel citaInicial={citaConfirmadaPasada} />);

        // El primer camino: la encuesta (tarjeta arriba).
        const cta = await screen.findByRole("link", { name: /contar cómo me fue/i });
        expect(cta.getAttribute("href")).toContain("/encuesta");

        // La vía de escape está cerrada: NO hay un [Pedir otra cita] en la pantalla.
        expect(screen.queryByRole("link", { name: /pedir otra cita/i }), "C2: no debe ofrecerse pedir otra cita en paralelo").toBeNull();
        expect(screen.queryByRole("link", { name: /elegir otro profesional/i })).toBeNull();

        // El encabezado dice la verdad («ya pasó») sin ofrecer reprogramar en paralelo.
        expect(screen.getByText(/esta cita ya pasó/i)).toBeTruthy();
    });

    it("sin encuesta pendiente (control): la tarjeta no aparece y el escape no se reabre solo", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ data: { pendientes: [] } }), { status: 200 })),
        );
        render(<EsperaCitaPanel citaInicial={citaConfirmadaPasada} />);
        expect(screen.getByText(/esta cita ya pasó/i)).toBeTruthy();
        await waitFor(() => {
            expect(screen.queryByRole("link", { name: /contar cómo me fue/i })).toBeNull();
        });
        // Y aun sin tarjeta, el «ya pasó» no reintroduce [Pedir otra cita] (la vista no lo ofrece).
        expect(screen.queryByRole("link", { name: /pedir otra cita/i })).toBeNull();
    });
});
