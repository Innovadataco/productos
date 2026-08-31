/**
 * F3 (N-5): ConsultaVaciaBloque — render del contenido curado y CTA con
 * prefill del identificador + evento analítico fire-and-forget al click.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConsultaVaciaBloque } from "./ConsultaVaciaBloque";
import { tomarHandoffReportar } from "@/lib/reportar-handoff";

// `vi.mock` se iza por encima de las constantes del módulo: el mock del router
// tiene que declararse con `vi.hoisted` para poder usarse dentro de la factory.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

const BLOQUE = {
    disclaimer: "Que no haya reportes no significa que sea seguro.",
    senales: ["Pide secreto", "Solicita fotos íntimas", "Ofrece regalos", "Propone encontrarse", "Dice ser menor"],
    acciones: ["Habla sin juzgar", "Guarda evidencia", "Canales oficiales"],
};

describe("ConsultaVaciaBloque (F3)", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
        pushMock.mockClear();
    });

    afterEach(() => {
        sessionStorage.clear();
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

    // Antes este CTA era un <Link> con `?identificador=` en el href: dejaba el
    // identificador consultado en la URL de una pantalla pública (historial,
    // Referer, logs). Ahora viaja por sessionStorage y la URL va limpia.
    it("el CTA lleva el identificador a /reportar por sessionStorage y NUNCA por la URL", () => {
        render(<ConsultaVaciaBloque bloque={BLOQUE} identificador="+57300 111" />);

        fireEvent.click(screen.getByRole("button", { name: "Reportar una conducta" }));

        // La navegación es a la URL limpia, sin rastro del identificador.
        expect(pushMock).toHaveBeenCalledWith("/reportar");
        expect(pushMock.mock.calls.every(([url]) => !String(url).includes("identificador"))).toBe(true);
        expect(pushMock.mock.calls.every(([url]) => !String(url).includes("57300"))).toBe(true);

        // El valor va por la llave de un solo uso, sin fijar el campo: acá es un
        // prellenado de cortesía y el usuario puede corregirlo.
        expect(tomarHandoffReportar()).toEqual({ identificador: "+57300 111", fijar: false });
    });

    it("dispara el evento analítico al click, sin el identificador en el body", () => {
        render(<ConsultaVaciaBloque bloque={BLOQUE} identificador="+57300 111" />);

        fireEvent.click(screen.getByRole("button", { name: "Reportar una conducta" }));

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
        expect(screen.getByRole("button", { name: "Reportar una conducta" })).toBeTruthy();
    });
});
