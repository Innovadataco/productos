/**
 * CANDADO · SPEC-792 C1+C3 — el cierre de la encuesta NUNCA deja al usuario sin salida, y la voz del
 * cierre es POR AUDIENCIA.
 *
 *  C1: tras enviar, LAS CUATRO combinaciones (padre/profesional × sí/no) ofrecen una salida real —nunca
 *      el botón atrás del navegador como única opción. (El callejón era el camino feliz: padre-sí y
 *      profesional terminaban en «gracias» sin un solo enlace.)
 *  C3: el cierre del padre-sí es CÁLIDO («contarnos cómo te fue»), NO «quedó registrado» (voz de
 *      archivador del profesional). Las dos cadenas NO son la misma.
 *
 * Unit (jsdom). Control positivo: afirma las cuatro ramas; quitar la salida de cualquiera lo rompe.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { EncuestaFormulario } from "./EncuestaFormulario";

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ data: { registrada: true } }), { status: 200 })),
    );
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function elegir(name: string, value: string) {
    const el = document.querySelector<HTMLInputElement>(`input[type="radio"][name="${name}"][value="${value}"]`);
    if (!el) throw new Error(`no hay radio ${name}=${value}`);
    el.click();
}

/** Llena la encuesta del lado/resultado pedido, envía, y devuelve el nodo del cierre. */
async function responderYCerrar(origen: "PADRE" | "PROFESIONAL", seRealizo: boolean): Promise<HTMLElement> {
    render(<EncuestaFormulario solicitudId="s1" origen={origen} fecha="27 de septiembre" />);
    elegir("SE_REALIZO", seRealizo ? "SI" : "NO");
    elegir("OPERADOR", "SI");
    elegir("INICIO", "A_TIEMPO");
    elegir("ENLACE", "SI");
    if (seRealizo) elegir("DURACION", "MENOS_15");
    else elegir("RAZON", "OTRA");
    const enviar = screen.getByRole("button", { name: origen === "PADRE" ? /contar cómo me fue/i : /registrar/i });
    enviar.click();
    // El cierre aparece tras el POST (mockeado ok).
    await screen.findByText(/gracias|lamentamos/i);
    return screen.getByText(/gracias|lamentamos/i).closest("section") as HTMLElement;
}

describe("SPEC-792 C1 · ningún cierre queda sin salida (las 4 combinaciones)", () => {
    it.each([
        ["PADRE", true],
        ["PADRE", false],
        ["PROFESIONAL", true],
        ["PROFESIONAL", false],
    ] as const)("cierre de %s · seRealizo=%s ofrece una salida (link o botón), no solo atrás", async (origen, seRealizo) => {
        const cierre = await responderYCerrar(origen, seRealizo);
        const salidas = cierre.querySelectorAll("a[href], button");
        expect(salidas.length, "el cierre debe ofrecer al menos una salida navegable").toBeGreaterThan(0);
    });
});

describe("SPEC-792 C3 · voz por audiencia en el cierre (las dos cadenas no son la misma)", () => {
    it("padre + «sí se realizó» → cierre CÁLIDO, NO «quedó registrado»", async () => {
        const cierre = await responderYCerrar("PADRE", true);
        expect(within(cierre).queryByText(/contarnos cómo te fue/i)).not.toBeNull();
        expect(cierre.textContent ?? "").not.toMatch(/quedó registrado/i);
        expect(within(cierre).getByRole("link", { name: /volver a mi panel/i }).getAttribute("href")).toBe("/dashboard");
    });

    it("profesional → cierre SOBRIO «quedó registrado» + salida a su panel", async () => {
        const cierre = await responderYCerrar("PROFESIONAL", true);
        expect(cierre.textContent ?? "").toMatch(/quedó registrado/i);
        expect(within(cierre).getByRole("link", { name: /volver a mi panel/i }).getAttribute("href")).toBe("/dashboard/profesional");
    });
});
