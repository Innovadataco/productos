import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SeguimientoClient } from "./SeguimientoClient";
import { REPORTAR_STORAGE_KEY } from "@/lib/reportar-handoff";

// `vi.mock` se iza por encima de las constantes del módulo: el mock del router
// tiene que declararse con `vi.hoisted` para poder usarse dentro de la factory.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useSearchParams: () => ({ get: vi.fn(() => "") }),
    useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

const baseData = {
    numeroSeguimiento: "RPT-ABC123",
    estadoVisual: "Procesado",
    estadoInterno: "CLASIFICADO",
    badge: "success",
    enProceso: false,
    creadoEn: "2026-07-18T10:00:00Z",
    actualizadoEn: "2026-07-18T10:05:00Z",
    mensaje: "Tu reporte ha sido procesado y clasificado.",
    slaHoras: 24,
    identificador: "30009000002",
    plataforma: "WhatsApp",
    clasificacion: {
        categoria: "SOLICITUD_MATERIAL",
        categoriaLabel: "Solicitud de material",
        categoriaGrupo: "Contacto sexual",
        categoriasSecundarias: ["CONTACTO_INSISTENTE"],
        contienePii: true,
    },
    ranking: { totalReportes: 5, reportesAutenticados: 2, reportesAnonimos: 3 },
    actividad: "alta",
};

describe("SeguimientoClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it("muestra el estado simplificado, las conductas y el riesgo con buen contraste", async () => {
        mockFetch(baseData);
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Procesado");
            expect(body).toContain("Tu reporte ha sido procesado y clasificado.");
            expect(body).toContain("Gracias por reportar.");
            expect(body).toContain("Conductas identificadas");
            expect(body).toContain("Solicitud de material");
            expect(body).toContain("Contacto insistente");
            // spec 089-US6: sin score ni etiqueta de riesgo; señal descriptiva de actividad
            expect(body).toContain("Actividad del identificador");
            expect(body).toContain("Actividad alta de reportes");
            expect(body).not.toContain("Riesgo ALTO");
            expect(body).not.toContain("Nivel de riesgo del identificador");
            expect(body).toContain("El texto fue anonimizado");
        });
    });

    it("muestra todas las conductas ordenadas por gravedad (principal + secundarias)", async () => {
        mockFetch({
            ...baseData,
            clasificacion: {
                ...baseData.clasificacion,
                categoria: "CONTACTO_INSISTENTE",
                categoriasSecundarias: ["EXTORSION", "SOLICITUD_ENCUENTRO"],
            },
        });
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Solicitud de encuentro");
            expect(body).toContain("Extorsión");
            expect(body).toContain("Contacto insistente");
            const iEncuentro = body.indexOf("Solicitud de encuentro");
            const iExtorsion = body.indexOf("Extorsión");
            const iContacto = body.indexOf("Contacto insistente");
            expect(iEncuentro).toBeGreaterThan(-1);
            expect(iEncuentro).toBeLessThan(iExtorsion);
            expect(iExtorsion).toBeLessThan(iContacto);
        });
    });

    it.each(["SPAM", "OTRO"])("muestra 'No se identifica riesgo' cuando la única categoría es %s", async (categoria) => {
        mockFetch({
            ...baseData,
            clasificacion: {
                ...baseData.clasificacion,
                categoria,
                categoriasSecundarias: [],
            },
        });
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("No se identifica riesgo");
            expect(body).not.toContain("SPAM");
            expect(body).not.toContain("Otro");
        });
    });

    it("muestra 'En proceso' cuando el reporte aún no está clasificado", async () => {
        mockFetch({
            ...baseData,
            estadoVisual: "En proceso",
            estadoInterno: "REVISION_MANUAL",
            badge: "warning",
            enProceso: true,
            mensaje: "Tu reporte está en proceso — puede tardar hasta 24 horas",
            clasificacion: null,
        });
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-XYZ789" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("En proceso");
            expect(body).toContain("puede tardar hasta 24 horas");
            expect(body).not.toContain("Conductas identificadas");
            expect(body).not.toContain("Contacto sexual");
        });
    });

    it("muestra error cuando el reporte no existe", async () => {
        mockFetch({ error: { message: "Reporte no encontrado" } }, false);
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-NOEXIST" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Reporte no encontrado");
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // SPEC-324: "otros reportes" + CTA que reporta de nuevo AL MISMO identificador.
    // ─────────────────────────────────────────────────────────────────────
    describe("SPEC-324 · otros reportes y CTA de nuevo reporte", () => {
        async function consultar(data: unknown) {
            mockFetch(data);
            render(<SeguimientoClient />);
            fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
                target: { value: "RPT-ABC123" },
            });
            fireEvent.click(screen.getByRole("button", { name: /consultar/i }));
            await waitFor(() => {
                expect(document.body.textContent).toContain("Tu reporte ha sido procesado");
            });
        }

        it("lista fecha, lugar y clasificación de los otros reportes", async () => {
            await consultar({
                ...baseData,
                otrosReportes: [
                    {
                        id: "otro-1",
                        creadoEn: "2026-07-20T15:30:00Z",
                        pais: "Colombia",
                        ciudad: "Medellín",
                        categoriaLabel: "Solicitud de encuentro",
                    },
                ],
            });

            const body = document.body.textContent || "";
            expect(body).toContain("Otros reportes de este identificador");
            expect(body).toContain("Medellín, Colombia");
            expect(body).toContain("Solicitud de encuentro");
            // Hora de Colombia (UTC-5): 15:30 UTC → 10:30 a. m.
            expect(body).toContain("10:30");
        });

        it("no dibuja el bloque cuando el backend manda null (visitante anónimo)", async () => {
            await consultar({ ...baseData, otrosReportes: null });

            expect(document.body.textContent).not.toContain("Otros reportes de este identificador");
        });

        it("no dibuja el bloque cuando la lista viene vacía", async () => {
            await consultar({ ...baseData, otrosReportes: [] });

            expect(document.body.textContent).not.toContain("Otros reportes de este identificador");
        });

        it("el CTA lleva el identificador a /reportar por sessionStorage, NO por la URL", async () => {
            await consultar({ ...baseData, otrosReportes: null });

            fireEvent.click(screen.getByRole("button", { name: /Reportar de nuevo a este identificador/i }));

            // El identificador queda en la llave de un solo uso...
            expect(sessionStorage.getItem(REPORTAR_STORAGE_KEY)).toBe("30009000002");
            // ...y la navegación es a la URL limpia (spec 091-US2 / 093-US4).
            expect(pushMock).toHaveBeenCalledWith("/reportar");
            expect(pushMock.mock.calls.every(([url]) => !String(url).includes("identificador"))).toBe(true);

            // El CTA genérico sigue existiendo, sin fijar nada.
            const generico = screen.getByRole("link", { name: /Realizar otro reporte/i });
            expect(generico.getAttribute("href")).toBe("/reportar");
        });
    });
});
