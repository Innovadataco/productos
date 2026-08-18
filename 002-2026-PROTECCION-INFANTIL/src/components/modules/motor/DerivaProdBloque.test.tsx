/**
 * SPEC-172 (Pilar D.5) — Tests unitarios del bloque "Deriva prod": tabla por
 * categoría con semáforos según brecha/umbral, banners de baseline (ausente y
 * desactualizada), recálculo bajo demanda que refresca la tabla y el rotulado
 * obligatorio de la métrica ("tasa de corrección sobre lo revisado", candado
 * del CEO). fetch mockeado con vi.stubGlobal; sin BD.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DerivaProdBloque, type FilaDerivaProd } from "./DerivaProdBloque";

const UMBRALES = { umbralPp: 15, minMuestra: 20 };

function fila(parcial: Partial<FilaDerivaProd> & Pick<FilaDerivaProd, "categoria">): FilaDerivaProd {
    return {
        total: 40,
        correcciones: 4,
        tasaCorreccion: 0.1,
        accuracyBanco: 0.95,
        brechaPp: 5,
        alertada: false,
        muestraInsuficiente: false,
        ...parcial,
    };
}

// Cobertura de los 5 estados del semáforo (umbral 15 pp, muestra mínima 20):
const FILAS_SEMAFORO: FilaDerivaProd[] = [
    // verde: brecha 5 < 15
    fila({ categoria: "EXTORSION", total: 40, correcciones: 4, tasaCorreccion: 0.1, accuracyBanco: 0.95, brechaPp: 5 }),
    // ámbar: 15 ≤ 20 ≤ 22.5 (1.5× umbral)
    fila({ categoria: "DOXING", total: 30, correcciones: 6, tasaCorreccion: 0.2, accuracyBanco: 0.9, brechaPp: 20, alertada: true }),
    // rojo: 32 > 22.5
    fila({ categoria: "CONTACTO_INSISTENTE", total: 25, correcciones: 9, tasaCorreccion: 0.36, accuracyBanco: 0.96, brechaPp: 32, alertada: true }),
    // gris: la categoría no tiene baseline en el banco (aunque la muestra alcanza)
    fila({ categoria: "OTRO", total: 22, correcciones: 3, tasaCorreccion: 0.136, accuracyBanco: null, brechaPp: null }),
    // gris: 10 < 20 revisadas, aunque la brecha (25) sería ámbar
    fila({ categoria: "SUPLANTACION_IDENTIDAD", total: 10, correcciones: 3, tasaCorreccion: 0.3, accuracyBanco: 0.95, brechaPp: 25, muestraInsuficiente: true }),
];

function respuestaGet(overrides: Record<string, unknown> = {}) {
    return {
        semanaInicio: "2026-08-17T05:00:00.000Z",
        filas: FILAS_SEMAFORO,
        baseline: { baselineFecha: "2026-08-10T00:00:00.000Z", baselineRunId: "run-1", baselineVieja: false },
        umbrales: UMBRALES,
        ...overrides,
    };
}

function stubFetchGet(cuerpo: unknown) {
    return vi.fn(async () => ({ ok: true, status: 200, json: async () => cuerpo }));
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("DerivaProdBloque", () => {
    it("renderiza la tabla por categoría con semáforos según brecha y umbral", async () => {
        vi.stubGlobal("fetch", stubFetchGet(respuestaGet()));
        render(<DerivaProdBloque />);

        await waitFor(() => expect(screen.getByText("Extorsión")).toBeTruthy());
        for (const categoria of ["Doxing", "Contacto insistente", "Otro", "Suplantación de identidad"]) {
            expect(screen.getByText(categoria)).toBeTruthy();
        }

        // Formato de 1 decimal en porcentajes y puntos porcentuales.
        expect(screen.getByText("10.0%")).toBeTruthy(); // tasa EXTORSION
        expect(screen.getByText("90.0%")).toBeTruthy(); // banco DOXING
        expect(screen.getByText("+32.0")).toBeTruthy(); // brecha CONTACTO_INSISTENTE

        // Semáforo por fila: verde, ámbar, rojo y los dos grises.
        expect(screen.getByText("Estable")).toBeTruthy();
        expect(screen.getByText("Deriva leve")).toBeTruthy();
        expect(screen.getByText("Deriva alta")).toBeTruthy();
        expect(screen.getByText("Sin baseline")).toBeTruthy();
        expect(screen.getByText("Muestra insuficiente")).toBeTruthy();

        // Contexto de la ventana medida con los umbrales vigentes.
        expect(screen.getByText(/Semana del 17\/08\/2026/)).toBeTruthy();
        expect(screen.getByText(/umbral de alerta: 15 pp/)).toBeTruthy();
    });

    it("sinBaseline muestra el banner con link a Simulación y no pinta tabla", async () => {
        vi.stubGlobal(
            "fetch",
            stubFetchGet({ filas: [], sinBaseline: true, mensaje: "Todavía no hay medición de deriva." })
        );
        render(<DerivaProdBloque />);

        await waitFor(() => expect(screen.getByText(/Sin baseline del banco — corre una simulación/)).toBeTruthy());
        expect(screen.getByText(/Todavía no hay medición de deriva/)).toBeTruthy();

        const linkBanner = screen.getByRole("link", { name: "Abrir Simulación" });
        expect(linkBanner.getAttribute("href")).toBe("/dashboard/admin/ia?tab=simulacion");
        // El CTA "Afinar en Simulación" siempre está visible, también sin datos.
        expect(screen.getByRole("link", { name: "Afinar en Simulación" }).getAttribute("href")).toBe(
            "/dashboard/admin/ia?tab=simulacion"
        );
        expect(screen.queryByRole("table")).toBeNull();
    });

    it("baselineVieja muestra el banner de baseline desactualizada con su fecha", async () => {
        vi.stubGlobal(
            "fetch",
            stubFetchGet(
                respuestaGet({
                    baseline: { baselineFecha: "2026-07-01T00:00:00.000Z", baselineRunId: "run-0", baselineVieja: true },
                })
            )
        );
        render(<DerivaProdBloque />);

        await waitFor(() =>
            expect(screen.getByText(/Baseline desactualizada \(01\/07\/2026\) — corre Simulación de nuevo/)).toBeTruthy()
        );
        // La tabla sigue pintando con el baseline viejo.
        expect(screen.getByText("Extorsión")).toBeTruthy();
    });

    it("Recalcular ahora llama POST y refresca la tabla con la respuesta", async () => {
        const filasNuevas: FilaDerivaProd[] = [
            fila({
                categoria: "COMPARTIMIENTO_SEXUAL",
                total: 50,
                correcciones: 15,
                tasaCorreccion: 0.3,
                accuracyBanco: 0.9,
                brechaPp: 20,
                alertada: true,
            }),
        ];
        const fetchMock = vi.fn(async (input: unknown, init?: { method?: string }) => {
            if (init?.method === "POST") {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        semanaInicio: "2026-08-17T05:00:00.000Z",
                        desde: "2026-08-10T05:00:00.000Z",
                        hasta: "2026-08-17T05:00:00.000Z",
                        filas: filasNuevas,
                    }),
                };
            }
            return { ok: true, status: 200, json: async () => respuestaGet() };
        });
        vi.stubGlobal("fetch", fetchMock);
        render(<DerivaProdBloque />);

        await waitFor(() => expect(screen.getByText("Extorsión")).toBeTruthy());
        fireEvent.click(screen.getByRole("button", { name: "Recalcular ahora" }));

        await waitFor(() => expect(screen.getByText("Compartimiento sexual")).toBeTruthy());
        expect(screen.queryByText("Extorsión")).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/admin/motor/deriva/recalcular",
            expect.objectContaining({ method: "POST" })
        );
        // La fila recalculada conserva los umbrales del GET: 20 pp ≤ 1.5×15 → ámbar.
        expect(screen.getByText("Deriva leve")).toBeTruthy();
    });

    it("rotula la métrica como tasa de corrección sobre lo revisado (candado del CEO)", async () => {
        vi.stubGlobal("fetch", stubFetchGet(respuestaGet()));
        render(<DerivaProdBloque />);

        await waitFor(() => expect(screen.getByText(/tasa de corrección sobre lo revisado/)).toBeTruthy());
        expect(screen.getByText(/No es un error absoluto/)).toBeTruthy();
    });
});
