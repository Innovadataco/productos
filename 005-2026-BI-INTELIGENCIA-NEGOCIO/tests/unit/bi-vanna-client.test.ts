import { describe, it, expect, vi, afterEach } from "vitest";
import { generarSql } from "@/lib/bi/vanna-client";

const fetchSpy = vi.spyOn(globalThis, "fetch");
afterEach(() => fetchSpy.mockReset());

describe("generarSql (vanna-client)", () => {
    it("200 con consenso true devuelve SQL + votos", async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    consenso: true,
                    sqlGenerado: "SELECT 1 FROM bi_reporte_diario LIMIT 1",
                    votosJurado: [
                        { modelo: "a", sqlCanonico: "s1" },
                        { modelo: "b", sqlCanonico: "s1" },
                        { modelo: "c", sqlCanonico: "s1" },
                    ],
                }),
                { status: 200 },
            ),
        );
        const r = await generarSql({ preguntaNL: "q", catalogo: { tablas: [] } });
        expect(r.consenso).toBe(true);
        expect(r.sqlGenerado).toContain("SELECT 1");
        expect(r.votosJurado).toHaveLength(3);
    });

    it("200 con consenso false", async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    consenso: false,
                    razon: "sin_consenso",
                    votosJurado: [],
                }),
                { status: 200 },
            ),
        );
        const r = await generarSql({ preguntaNL: "q", catalogo: { tablas: [] } });
        expect(r.consenso).toBe(false);
        expect(r.razon).toBe("sin_consenso");
    });

    it("http 500 marca error vanna_http_500", async () => {
        fetchSpy.mockResolvedValueOnce(new Response("boom", { status: 500 }));
        const r = await generarSql({ preguntaNL: "q", catalogo: { tablas: [] } });
        expect(r.consenso).toBe(false);
        expect(r.error).toContain("vanna_http_500");
    });

    it("timeout / network error marca vanna_unreachable", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("The operation was aborted"));
        const r = await generarSql({ preguntaNL: "q", catalogo: { tablas: [] } });
        expect(r.consenso).toBe(false);
        expect(r.error).toContain("vanna_unreachable");
    });
});
