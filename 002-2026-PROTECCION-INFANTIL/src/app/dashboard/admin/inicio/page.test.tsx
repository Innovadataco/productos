/**
 * SPEC-378 · Inicio del administrador — vacío grita silencio, alertas muestran
 * tarjetas ámbar. La regla dura de Jelkin manda: NUNCA rojo. El test barre
 * cada elemento y afirma cero clases red-* (patrón SPEC-377/I-268).
 *
 * SPEC-414 · el interruptor de datos de prueba y las señales degradadas (I-294).
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

/** El estado que devuelve el servicio, con los campos que la pantalla exige. */
function estado(over: Partial<Parameters<typeof mocks.calcularEstadoInicio.mockResolvedValue>[0]> = {}) {
    return {
        alertas: [],
        degradadas: [],
        ok: [],
        generadoEn: new Date().toISOString(),
        latenciaMs: 42,
        incluyeSembrados: false,
        sembrados: { total: 0, porSenal: [] },
        ...over,
    };
}

/** La página es un server component con `searchParams` asíncrono (Next 16). */
function abrir(params: { prueba?: string } = {}) {
    return AdminInicioPage({ searchParams: Promise.resolve(params) });
}

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
        const jsx = await abrir();
        render(jsx);
        expect(screen.getByText("sin acceso")).toBeDefined();
        expect(mocks.calcularEstadoInicio).not.toHaveBeenCalled();
    });

    it("con alertas vacías → texto de calma, sin listas ni tarjetas", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado());
        const jsx = await abrir();
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
        mocks.calcularEstadoInicio.mockResolvedValue(estado({
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
        }));
        const jsx = await abrir();
        const { container } = render(jsx);

        // Secciones separadas por prioridad.
        expect(screen.getByText("Urgente")).toBeDefined();
        expect(screen.getByText("Requiere revisión")).toBeDefined();

        // Los dos textos aparecen y los links llevan a la ruta correcta.
        expect(screen.getByText(/cuota agotada/i)).toBeDefined();
        expect(screen.getByText(/sin dueño/i)).toBeDefined();
        const resolverLinks = screen.getAllByRole("link", { name: /^resolver$/i });
        expect(resolverLinks).toHaveLength(2);
        expect(resolverLinks[0].getAttribute("href")).toBe("/dashboard/admin/notificaciones/salud");
        expect(resolverLinks[1].getAttribute("href")).toBe("/dashboard/admin/operadores/asignar");

        // El acento es ÁMBAR — al menos un elemento con el token `ambar`
        // (SPEC-483 migró el crudo `amber-*` al token: `border-l-ambar`).
        const conAmbar = container.querySelectorAll("[class*='ambar']");
        expect(conAmbar.length, "las tarjetas deben usar ámbar como acento").toBeGreaterThan(0);

        // Y cero rojo en toda la pantalla.
        assertCeroRojo(container);
    });

    it("cuenta las alertas en el subtítulo (n urgentes) — para que el admin vea el bulto de un vistazo", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado({
            alertas: [
                { id: "a1", prioridad: "alta", texto: "x", ruta: "/x" },
                { id: "a2", prioridad: "alta", texto: "y", ruta: "/y" },
                { id: "m1", prioridad: "media", texto: "z", ruta: "/z" },
            ],
        }));
        const jsx = await abrir();
        render(jsx);
        expect(screen.getByText(/3 señales.*2 urgentes/i)).toBeDefined();
    });
});

describe("/dashboard/admin/inicio · SPEC-414 · el interruptor de datos de prueba", () => {
    afterEach(() => vi.restoreAllMocks());

    it("por defecto pide SOLO LO REAL — invertir el default ES el arreglo de I-271", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado());
        render(await abrir());
        expect(mocks.calcularEstadoInicio).toHaveBeenCalledWith({ incluirSembrados: false });
        expect(screen.getByText("Viendo solo datos reales.")).toBeDefined();
    });

    it("con ?prueba=1 trae de vuelta lo sembrado", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado({
            incluyeSembrados: true,
            sembrados: { total: 250, porSenal: [{ id: "comite_vencido", sembrados: 250 }] },
        }));
        render(await abrir({ prueba: "1" }));
        expect(mocks.calcularEstadoInicio).toHaveBeenCalledWith({ incluirSembrados: true });
        expect(screen.getByText("Viendo datos reales y de prueba.")).toBeDefined();
        expect(screen.getByText(/250 registro\(s\) de prueba \(sembrados y de simulación\) están contando/i)).toBeDefined();
    });

    it("el conteo de lo sembrado SIEMPRE se ve — nada queda oculto", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado({
            sembrados: { total: 250, porSenal: [{ id: "comite_vencido", sembrados: 250 }] },
        }));
        render(await abrir());
        expect(screen.getByText(/250 registro\(s\) de prueba \(sembrados y de simulación\) quedaron fuera/i)).toBeDefined();
    });

    it("el interruptor es un enlace que alterna el modo en la URL", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado());
        render(await abrir());
        const link = screen.getByRole("link", { name: /incluir datos de prueba/i });
        expect(link.getAttribute("href")).toBe("/dashboard/admin/inicio?prueba=1");

        vi.clearAllMocks();
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado({ incluyeSembrados: true }));
        render(await abrir({ prueba: "1" }));
        const volver = screen.getByRole("link", { name: /ver solo lo real/i });
        expect(volver.getAttribute("href")).toBe("/dashboard/admin/inicio");
    });

    it("sin datos de prueba lo dice explícitamente, no calla", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado());
        render(await abrir());
        expect(screen.getByText(/No hay datos de prueba en las colas de trabajo/i)).toBeDefined();
    });
});

describe("/dashboard/admin/inicio · I-294 · una señal rota se VE, no desaparece", () => {
    afterEach(() => vi.restoreAllMocks());

    it("muestra las señales que no se pudieron calcular, con su nombre", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado({
            degradadas: [
                { id: "revision_manual_saturada", etiqueta: "cola de revisión manual" },
                { id: "comite_vencido", etiqueta: "casos vencidos del comité" },
            ],
        }));
        const { container } = render(await abrir());
        expect(screen.getByText(/No pudimos calcular 2 señales/i)).toBeDefined();
        expect(screen.getByText("cola de revisión manual")).toBeDefined();
        expect(screen.getByText("casos vencidos del comité")).toBeDefined();
        assertCeroRojo(container);
    });

    it("dice que el silencio NO prueba que esté bien", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado({
            degradadas: [{ id: "infra", etiqueta: "infraestructura" }],
        }));
        render(await abrir());
        expect(screen.getByText(/no significa que estén bien/i)).toBeDefined();
        // Y convive con el "todo tranquilo": no hay alertas, pero tampoco calma real.
        expect(screen.getByText("Todo tranquilo.")).toBeDefined();
    });

    it("sin degradadas no aparece el bloque", async () => {
        mocks.verificarAccesoPagina.mockResolvedValue({ permitido: true, rol: "ADMIN" });
        mocks.calcularEstadoInicio.mockResolvedValue(estado());
        render(await abrir());
        expect(screen.queryByText(/No pudimos calcular/i)).toBeNull();
    });
});
