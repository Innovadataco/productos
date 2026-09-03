/**
 * SPEC-378 · Inicio del administrador — vacío grita silencio, alertas muestran
 * tarjetas ámbar. La regla dura de Jelkin manda: NUNCA rojo. El test barre
 * cada elemento y afirma cero clases red-* (patrón SPEC-377/I-268).
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mocks izados: la página es un server component `async` que llama al servicio
// y a `verificarAccesoPagina`. Los interceptamos antes del import de la página.
const mocks = vi.hoisted(() => ({
    calcularEstadoInicio: vi.fn(),
    verificarAccesoPagina: vi.fn(),
}));

vi.mock("@/lib/dal/services/inicio-admin", () => ({
    calcularEstadoInicio: mocks.calcularEstadoInicio,
}));

vi.mock("@/lib/permisos-modulos", () => ({
    verificarAccesoPagina: mocks.verificarAccesoPagina,
}));

vi.mock("@/components/modules/SinAccesoModulo", () => ({
    SinAccesoModulo: () => <div>sin acceso</div>,
}));

import AdminInicioPage from "./page";

const PATRONES_ROJOS = [
    /\bbg-red-/,
    /\btext-red-/,
    /\bborder-red-/,
    /\bring-red-/,
    /\bfrom-red-/,
    /\bto-red-/,
    /\bhover:bg-red-/,
];

function assertCeroRojo(container: HTMLElement) {
    for (const el of container.querySelectorAll("*")) {
        const cls = el.className;
        const s = typeof cls === "string" ? cls : (cls as SVGAnimatedString | undefined)?.baseVal ?? "";
        for (const patron of PATRONES_ROJOS) {
            expect(s, `elemento con clase roja: ${s}`).not.toMatch(patron);
        }
        const inline = (el as HTMLElement).getAttribute("style") ?? "";
        expect(inline.toLowerCase()).not.toMatch(/rgb\s*\(\s*185\s*,\s*28\s*,\s*28\s*\)/);
    }
}

describe("/dashboard/admin/inicio · SPEC-378", () => {
    afterEach(() => vi.restoreAllMocks());

    it("sin módulo → cae en SinAccesoModulo (no revela datos)", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: false, rol: "ADMIN" });
        const jsx = await AdminInicioPage();
        render(jsx);
        expect(screen.getByText("sin acceso")).toBeDefined();
        expect(mocks.calcularEstadoInicio).not.toHaveBeenCalled();
    });

    it("con alertas vacías → texto de calma, sin listas ni tarjetas", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue({
            alertas: [],
            ok: [],
            generadoEn: new Date().toISOString(),
            latenciaMs: 42,
        });
        const jsx = await AdminInicioPage();
        const { container } = render(jsx);
        expect(screen.getByText("Todo tranquilo.")).toBeDefined();
        expect(screen.getByText(/Nada requiere tu atención ahora/i)).toBeDefined();
        // Ni una sola sección de alertas (urgente/media).
        expect(screen.queryByText("Urgente")).toBeNull();
        expect(screen.queryByText("Requiere revisión")).toBeNull();
        assertCeroRojo(container);
    });

    it("con una alerta ALTA + una MEDIA → dos secciones, tarjetas ámbar, links Resolver", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue({
            alertas: [
                {
                    id: "correos_no_salen",
                    prioridad: "alta",
                    texto: "Los correos no están saliendo: cuota agotada.",
                    ruta: "/dashboard/admin/notificaciones/salud",
                },
                {
                    id: "reportes_huerfanos",
                    prioridad: "media",
                    texto: "5 reportes llevan más de 24 h sin dueño.",
                    ruta: "/dashboard/admin/operadores/asignar",
                },
            ],
            ok: [],
            generadoEn: new Date().toISOString(),
            latenciaMs: 120,
        });
        const jsx = await AdminInicioPage();
        const { container } = render(jsx);

        // Secciones separadas por prioridad.
        expect(screen.getByText("Urgente")).toBeDefined();
        expect(screen.getByText("Requiere revisión")).toBeDefined();

        // Los dos textos aparecen y los links llevan a la ruta correcta.
        expect(screen.getByText(/cuota agotada/i)).toBeDefined();
        expect(screen.getByText(/sin dueño/i)).toBeDefined();
        const resolverLinks = screen.getAllByRole("link", { name: /resolver/i });
        expect(resolverLinks).toHaveLength(2);
        expect(resolverLinks[0].getAttribute("href")).toBe("/dashboard/admin/notificaciones/salud");
        expect(resolverLinks[1].getAttribute("href")).toBe("/dashboard/admin/operadores/asignar");

        // El acento es ÁMBAR — al menos un elemento con `border-amber-`.
        const conAmbar = container.querySelectorAll("[class*='amber-']");
        expect(conAmbar.length, "las tarjetas deben usar ámbar como acento").toBeGreaterThan(0);

        // Y cero rojo en toda la pantalla.
        assertCeroRojo(container);
    });

    it("cuenta las alertas en el subtítulo (n urgentes) — para que el admin vea el bulto de un vistazo", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue({
            alertas: [
                { id: "a1", prioridad: "alta", texto: "x", ruta: "/x" },
                { id: "a2", prioridad: "alta", texto: "y", ruta: "/y" },
                { id: "m1", prioridad: "media", texto: "z", ruta: "/z" },
            ],
            ok: [],
            generadoEn: new Date().toISOString(),
            latenciaMs: 30,
        });
        const jsx = await AdminInicioPage();
        render(jsx);
        expect(screen.getByText(/3 señales.*2 urgentes/i)).toBeDefined();
    });
});
