import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EstadoSistemaWidget } from "@/components/bi/estado/EstadoSistemaWidget";

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

function okRes(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

const baseData = {
    vanna: { ok: true, latenciaMs: 12 },
    superset: { ok: true, latenciaMs: 40 },
    pi: { ok: true, latenciaMs: 33 },
    ultimoReporte: null,
    tsGeneradoEn: new Date().toISOString(),
};

describe("EstadoSistemaWidget", () => {
    it("muestra skeleton primero y luego 3 pastillas + card reporte", async () => {
        fetchMock.mockResolvedValueOnce(okRes(baseData));
        render(<EstadoSistemaWidget endpointUrl="http://localhost/api/bi/estado-sistema" />);
        expect(screen.getByTestId("estado-skeleton")).toBeDefined();
        await waitFor(() => expect(screen.getByTestId("estado-sistema")).toBeDefined());
        expect(screen.getByTestId("pastilla-vanna").getAttribute("data-ok")).toBe("true");
        expect(screen.getByTestId("pastilla-superset").getAttribute("data-ok")).toBe("true");
        expect(screen.getByTestId("pastilla-pi").getAttribute("data-ok")).toBe("true");
        expect(screen.getByTestId("card-ultimo-reporte")).toBeDefined();
    });

    it("superset down → pastilla superset roja, vanna y pi verdes (no crashea)", async () => {
        fetchMock.mockResolvedValueOnce(
            okRes({
                ...baseData,
                superset: { ok: false, error: "no_disponible" },
            }),
        );
        render(<EstadoSistemaWidget endpointUrl="http://localhost/api/bi/estado-sistema" />);
        await waitFor(() => expect(screen.getByTestId("estado-sistema")).toBeDefined());
        expect(screen.getByTestId("pastilla-superset").getAttribute("data-ok")).toBe("false");
        expect(screen.getByTestId("pastilla-vanna").getAttribute("data-ok")).toBe("true");
        expect(screen.getByTestId("pastilla-pi").getAttribute("data-ok")).toBe("true");
        expect(screen.getByTestId("pastilla-superset").textContent).toContain("no_disponible");
    });

    it("último reporte con datos → muestra estado + latencia", async () => {
        const creadoEn = new Date(Date.now() - 60_000).toISOString();
        fetchMock.mockResolvedValueOnce(
            okRes({
                ...baseData,
                ultimoReporte: { id: "log-x", estado: "OK", creadoEn, latenciaMs: 240 },
            }),
        );
        render(<EstadoSistemaWidget endpointUrl="http://localhost/api/bi/estado-sistema" />);
        await waitFor(() => expect(screen.getByTestId("card-ultimo-reporte")).toBeDefined());
        const card = screen.getByTestId("card-ultimo-reporte");
        expect(card.textContent).toContain("OK");
        expect(card.textContent).toContain("240 ms");
    });

    it("último reporte con error de BD → muestra mensaje aislado", async () => {
        fetchMock.mockResolvedValueOnce(
            okRes({
                ...baseData,
                ultimoReporte: null,
                ultimoReporteError: "connection refused localhost:5432",
            }),
        );
        render(<EstadoSistemaWidget endpointUrl="http://localhost/api/bi/estado-sistema" />);
        await waitFor(() => expect(screen.getByTestId("card-ultimo-reporte")).toBeDefined());
        expect(screen.getByTestId("card-ultimo-reporte").textContent).toContain("consulta a BD falló");
    });

    it("endpoint devuelve 500 → widget muestra estado-error, no crashea la página", async () => {
        fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
        render(<EstadoSistemaWidget endpointUrl="http://localhost/api/bi/estado-sistema" />);
        await waitFor(() => expect(screen.getByTestId("estado-error")).toBeDefined());
    });
});
