/**
 * SPEC-149 (US4) · rediseño SPEC-353 (A-69 · C6, T006) — Configuración de avisos
 * con el patrón A-62: frases R5 con Switch y PATCH inmediato (optimista +
 * reversión en fallo), umbrales como frase que persisten en blur, cabecera
 * "Le escribimos a {correo}" con edición del override. Voz de usted, cero rojo.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConfiguracionPageClient from "./ConfiguracionPageClient";

const ITEMS = [
    { tipoEvento: "REPORTE_NUEVO", habilitado: true, emailDestino: null, emailEfectivo: "rector@colegio.edu.co", umbral: null, ventanaDias: null },
    { tipoEvento: "UMBRAL_CURSO", habilitado: true, emailDestino: null, emailEfectivo: "rector@colegio.edu.co", umbral: 3, ventanaDias: 7 },
    { tipoEvento: "ESTUDIANTE_REPETIDO", habilitado: true, emailDestino: null, emailEfectivo: "rector@colegio.edu.co", umbral: 2, ventanaDias: 30 },
    { tipoEvento: "RESUMEN_SEMANAL", habilitado: false, emailDestino: null, emailEfectivo: "rector@colegio.edu.co", umbral: null, ventanaDias: null },
];

/**
 * Mock de fetch ENRUTADO POR URL: la pantalla comparte página con el
 * EscudoColegioUploader de SPEC-351 (que consulta /api/colegio/configuracion/escudo),
 * así que un mock por orden de llamadas se cruzaría con sus fetches.
 */
function mockFetch(opts: { items?: unknown[]; onPatch?: () => { ok: boolean; mensaje?: string } } = {}) {
    const patches: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (!String(url).includes("/api/colegio/preferencias-avisos")) {
            return { ok: true, status: 200, json: async () => ({}) };
        }
        if (init?.method === "PATCH") {
            patches.push(JSON.parse(String(init.body)));
            const r = opts.onPatch?.() ?? { ok: true };
            return {
                ok: r.ok,
                status: r.ok ? 200 : 400,
                json: async () => (r.ok ? {} : { error: { message: r.mensaje ?? "No pudimos guardar el aviso" } }),
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({ items: opts.items ?? ITEMS, emailPorDefecto: "rector@colegio.edu.co" }),
        };
    });
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, patches };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ConfiguracionPageClient (SPEC-353 · diseño A-62)", () => {
    it("pinta las 4 frases R5 en usted, con Switch por fila y cero jerga ni tuteo", async () => {
        mockFetch();
        render(<ConfiguracionPageClient />);

        expect(await screen.findByText("Cuando alguien reporte una cuenta de su comunidad")).toBeTruthy();
        expect(screen.getByText("Cuando un curso acumule varios reportes en pocos días")).toBeTruthy();
        expect(screen.getByText("Cuando un mismo estudiante vuelva a aparecer")).toBeTruthy();
        expect(screen.getByText("Un resumen de su colegio cada semana")).toBeTruthy();
        expect(screen.getAllByRole("switch")).toHaveLength(4);
        // No quedan los botones Activado/Desactivado ni el botón Guardar.
        expect(screen.queryByRole("button", { name: /Activado|Desactivado|Guardar/ })).toBeNull();

        const texto = (document.body.textContent || "").toLowerCase();
        for (const prohibido of ["idempotencia", "digest", "te avisamos", "tu colegio", "elige"]) {
            expect(texto, `sin "${prohibido}"`).not.toContain(prohibido);
        }
    });

    it("cabecera: muestra el correo efectivo y el override se edita en línea (PATCH a los 4 tipos)", async () => {
        const { patches } = mockFetch();
        render(<ConfiguracionPageClient />);
        await screen.findByText(/Le escribimos a/);
        expect(screen.getByText("rector@colegio.edu.co")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));
        const input = screen.getByLabelText("Correo de destino de los avisos");
        fireEvent.change(input, { target: { value: "rectoria@colegio.edu.co" } });
        fireEvent.blur(input);

        await waitFor(() => expect(patches).toHaveLength(4));
        expect(patches.every((p) => p.emailDestino === "rectoria@colegio.edu.co")).toBe(true);
        expect(await screen.findByText("rectoria@colegio.edu.co")).toBeTruthy();
    });

    it("toggle → PATCH inmediato optimista, sin botón Guardar", async () => {
        const { patches } = mockFetch();
        render(<ConfiguracionPageClient />);
        await screen.findByText("Un resumen de su colegio cada semana");

        fireEvent.click(screen.getByRole("switch", { name: "Un resumen de su colegio cada semana" }));
        await waitFor(() => expect(patches).toHaveLength(1));
        expect(patches[0]).toEqual({ tipoEvento: "RESUMEN_SEMANAL", habilitado: true });
        expect(
            (screen.getByRole("switch", { name: "Un resumen de su colegio cada semana" })).getAttribute("aria-checked"),
        ).toBe("true");
    });

    it("PATCH fallido → el switch REVIERTE y el mensaje sale en ámbar (nunca rojo)", async () => {
        mockFetch({ onPatch: () => ({ ok: false, mensaje: "No pudimos guardar el aviso" }) });
        render(<ConfiguracionPageClient />);
        await screen.findByText("Un resumen de su colegio cada semana");

        fireEvent.click(screen.getByRole("switch", { name: "Un resumen de su colegio cada semana" }));
        const alerta = await screen.findByRole("alert");
        expect(alerta.textContent).toContain("No pudimos guardar el aviso");
        expect(alerta.className).toContain("ambar");
        expect(alerta.className).not.toMatch(/red-|rubi/);
        expect(
            (screen.getByRole("switch", { name: "Un resumen de su colegio cada semana" })).getAttribute("aria-checked"),
        ).toBe("false");
    });

    it("umbral como frase: editar y salir del campo hace PATCH con umbral y ventana", async () => {
        const { patches } = mockFetch();
        render(<ConfiguracionPageClient />);
        await screen.findByText("Cuando un curso acumule varios reportes en pocos días");
        expect(screen.getAllByText(/Avisar a partir de/).length).toBe(2);

        const umbral = screen.getByLabelText("Umbral de reportes para Cuando un curso acumule varios reportes en pocos días");
        fireEvent.change(umbral, { target: { value: "5" } });
        fireEvent.blur(umbral);

        await waitFor(() => expect(patches).toHaveLength(1));
        expect(patches[0]).toEqual({ tipoEvento: "UMBRAL_CURSO", umbral: 5, ventanaDias: 7 });
    });

    it("umbral sin cambios: el blur NO dispara PATCH", async () => {
        const { patches } = mockFetch();
        render(<ConfiguracionPageClient />);
        await screen.findByText("Cuando un curso acumule varios reportes en pocos días");

        const umbral = screen.getByLabelText("Umbral de reportes para Cuando un curso acumule varios reportes en pocos días");
        fireEvent.blur(umbral);
        await new Promise((r) => setTimeout(r, 20));
        expect(patches).toHaveLength(0);
    });

    it("error de carga muestra ErrorState con reintento", async () => {
        let intentos = 0;
        const fetchMock = vi.fn().mockImplementation(async (url: string) => {
            if (!String(url).includes("/api/colegio/preferencias-avisos")) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            intentos += 1;
            return intentos === 1
                ? { ok: false, status: 500, json: async () => ({ error: { message: "Se cayó" } }) }
                : { ok: true, status: 200, json: async () => ({ items: ITEMS, emailPorDefecto: "rector@colegio.edu.co" }) };
        });
        vi.stubGlobal("fetch", fetchMock);
        render(<ConfiguracionPageClient />);

        expect(await screen.findByText("No pudimos cargar la configuración")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /Reintentar|Intentar/ }));
        expect(await screen.findByText("Cuando alguien reporte una cuenta de su comunidad")).toBeTruthy();
    });
});
