/**
 * SPEC-730 · CANDADO — el padre usa la MISMA rejilla visual del profesional (SPEC-714),
 * NO una lista, en sus dos superficies:
 *   (1) elegir franja al pedir cita (dentro de `SolicitarCitaPanel`);
 *   (2) «Mis citas» (`RejillaMisCitas`).
 *
 * La marca estructural de la rejilla compartida es la columna de día `[data-col]`
 * (la pinta `RejillaCalendario`). Una LISTA no la tiene. Verificado por MUTACIÓN:
 * volver cualquiera de las dos a una `<ul>`/tarjetas quita `[data-col]` → rojo. El
 * padre no publica: el bloque de «Mis citas» es un enlace al detalle existente y el
 * de elegir-franja es un botón que selecciona (sin arrastrar-para-crear).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const leerBorrador = vi.fn();
vi.mock("@/lib/padre/borrador-consulta", () => ({
    leerBorradorConsulta: () => leerBorrador(),
    borrarBorradorConsulta: vi.fn(),
}));

import { SolicitarCitaPanel } from "@/components/modules/padre/profesionales/SolicitarCitaPanel";
import { RejillaMisCitas } from "./RejillaMisCitas";

beforeEach(() => {
    leerBorrador.mockReset();
    leerBorrador.mockReturnValue({ presentacion: "Un relato suficientemente largo para el mínimo.", urgencia: "SIN_APURO" });
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function franja(id: string, dias: number, modalidad: "VIRTUAL" | "PRESENCIAL") {
    const inicio = new Date(Date.now() + dias * 24 * 3_600_000);
    return { id, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 3_600_000).toISOString(), modalidad };
}

function citaPadre(id: string, dias: number): CitaParaPadreDto {
    const inicio = new Date(Date.now() + dias * 24 * 3_600_000);
    return {
        id,
        estado: "CONFIRMADA",
        urgencia: "SIN_APURO",
        creadoEn: new Date().toISOString(),
        venceEn: new Date().toISOString(),
        pagoAprobadoEn: null,
        montoTotal: 80_000,
        profesional: { id: "p1", nombreVisible: " Psic. Ana", tituloProfesional: "Psicóloga", ciudad: { id: "c1", nombre: "Bogotá" } },
        franja: { inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 3_600_000).toISOString(), modalidad: "VIRTUAL" },
        solicitudPreviaId: null,
        pagoHeredadoDeId: null,
        expedienteCompartidoId: null,
    };
}

describe("SPEC-730 · el padre elige y ve sus citas en la rejilla, no en una lista", () => {
    it("(1) elegir franja pinta la rejilla (columnas [data-col]) y el toque selecciona la franja", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [franja("f1", 2, "VIRTUAL")] }), { status: 200 }));
        const { container } = render(
            <SolicitarCitaPanel profesionalId="prof1" tarifaProfesionalCOP={120_000} precioEstandarPrimeraCitaCOP={80_000} duracionMinutos={45} />,
        );
        // Las franjas cargan async: se espera el bloque, luego se afirma la estructura.
        const bloque = await screen.findByText("Virtual");
        // Es la rejilla (columnas de día), no una <ul> de franjas.
        expect(container.querySelectorAll("[data-col]").length).toBeGreaterThan(0);
        // El bloque de la franja es un botón seleccionable dentro de la rejilla.
        const boton = bloque.closest("button");
        expect(boton).toBeTruthy();
        fireEvent.click(bloque);
        expect(boton?.getAttribute("aria-pressed")).toBe("true");
    });

    it("(2) «Mis citas» pinta la rejilla y cada cita ENLAZA a su detalle existente", () => {
        const { container } = render(<RejillaMisCitas citas={[citaPadre("cita9", 1)]} />);
        expect(container.querySelectorAll("[data-col]").length).toBeGreaterThan(0);
        // El bloque de la cita entra al detalle que ya existe (no reconstruye panel).
        const enlace = container.querySelector('a[href="/dashboard/padre/citas/cita9"]');
        expect(enlace).toBeTruthy();
        // No es la lista por pestañas anterior.
        expect(screen.queryByRole("button", { name: /Próximas/ })).toBeNull();
    });

    it("(2) «Mis citas» sin citas: estado vacío, sin rejilla", () => {
        const { container } = render(<RejillaMisCitas citas={[]} />);
        expect(container.querySelectorAll("[data-col]").length).toBe(0);
        expect(screen.getByText("Todavía no tienes citas.")).toBeTruthy();
    });
});
