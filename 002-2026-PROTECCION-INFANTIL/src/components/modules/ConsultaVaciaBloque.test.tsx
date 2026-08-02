/**
 * F3 (N-5): ConsultaVaciaBloque — render del contenido curado y CTA con
 * prefill del identificador + evento analítico fire-and-forget al click.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConsultaVaciaBloque } from "./ConsultaVaciaBloque";

const BLOQUE = {
    disclaimer: "Que no haya reportes no significa que sea seguro.",
    senales: ["Pide secreto", "Solicita fotos íntimas", "Ofrece regalos", "Propone encontrarse", "Dice ser menor"],
    acciones: ["Habla sin juzgar", "Guarda evidencia", "Canales oficiales"],
};

describe("ConsultaVaciaBloque (F3)", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    });

    it("renderiza disclaimer, señales, acciones y canales oficiales", () => {
        render(<ConsultaVaciaBloque bloque={BLOQUE} identificador="+57300111222" />);

        expect(screen.getByText(BLOQUE.disclaimer)).toBeTruthy();
        for (const senal of BLOQUE.senales) {
            expect(screen.getByText(senal)).toBeTruthy();
        }
        for (const accion of BLOQUE.acciones) {
            expect(screen.getByText(accion)).toBeTruthy();
        }
        // Canales oficiales siempre visibles (regla de producto).
        expect(screen.getByText("Línea 141")).toBeTruthy();
        expect(screen.getByText("CAI Virtual")).toBeTruthy();
        expect(screen.getByText("Te Protejo")).toBeTruthy();
    });

    it("el CTA apunta a /reportar con el identificador prellenado y dispara el evento al click", () => {
        render(<ConsultaVaciaBloque bloque={BLOQUE} identificador="+57300 111" />);

        const cta = screen.getByRole("link", { name: "Reportar una conducta" });
        expect(cta.getAttribute("href")).toBe(`/reportar?identificador=${encodeURIComponent("+57300 111")}`);

        fireEvent.click(cta);
        expect(fetch).toHaveBeenCalledWith("/api/consulta/evento", expect.objectContaining({ method: "POST" }));
        // Privacidad: el body del evento NUNCA lleva el identificador.
        const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
        expect(body).toEqual({ evento: "consulta_vacia_cta_reportar" });
        expect(JSON.stringify(body)).not.toContain("57300");
    });

    it("omite secciones ausentes (degradación limpia)", () => {
        render(<ConsultaVaciaBloque bloque={{ disclaimer: "Solo aviso." }} identificador="@nick" />);

        expect(screen.getByText("Solo aviso.")).toBeTruthy();
        expect(screen.queryByText("Señales de alerta a las que estar atento")).toBeNull();
        expect(screen.queryByText("Qué puedes hacer")).toBeNull();
        expect(screen.getByRole("link", { name: "Reportar una conducta" })).toBeTruthy();
    });
});
