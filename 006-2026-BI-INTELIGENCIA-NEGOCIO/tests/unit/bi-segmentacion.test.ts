// tests/unit/bi-segmentacion.test.ts · Segmentación demo/real (CEO 12-09-2026)
// Producto 006 · BI v2
// Cubre src/lib/bi/segmentacion.ts: el predicado canónico vive en el SQL
// (marcado O simulación); acá se prueba el contrato de datos y el cálculo
// del porcentaje. Unitarios puros: prisma mockeado, sin BD, sin red.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: { $queryRaw: mocks.queryRaw },
}));

import { getSegmentacion } from "@/lib/bi/segmentacion";

describe("getSegmentacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("computa pctDemo con 1 decimal sobre el total no eliminado", async () => {
        mocks.queryRaw.mockResolvedValue([{ total: 4207, marcados: 4200, simulados: 0, demo: 4200 }]);
        const seg = await getSegmentacion();
        expect(seg).toEqual({ total: 4207, marcados: 4200, simulados: 0, demo: 4200, pctDemo: 99.8 });
    });

    it("universo 100% demo: pctDemo = 100", async () => {
        mocks.queryRaw.mockResolvedValue([{ total: 500, marcados: 500, simulados: 0, demo: 500 }]);
        const seg = await getSegmentacion();
        expect(seg.pctDemo).toBe(100);
    });

    it("universo real (0 demo): pctDemo = 0 y el desglose se lee «aún no pasa»", async () => {
        mocks.queryRaw.mockResolvedValue([{ total: 7, marcados: 0, simulados: 0, demo: 0 }]);
        const seg = await getSegmentacion();
        expect(seg.pctDemo).toBe(0);
        expect(seg.marcados).toBe(0);
        expect(seg.simulados).toBe(0);
    });

    it("total 0 (réplica sin reportes): pctDemo 0, sin división por cero", async () => {
        mocks.queryRaw.mockResolvedValue([{ total: 0, marcados: 0, simulados: 0, demo: 0 }]);
        const seg = await getSegmentacion();
        expect(seg.pctDemo).toBe(0);
    });

    it("sin filas de resultado: degrada a ceros explícitos", async () => {
        mocks.queryRaw.mockResolvedValue([]);
        const seg = await getSegmentacion();
        expect(seg).toEqual({ total: 0, marcados: 0, simulados: 0, demo: 0, pctDemo: 0 });
    });

    it("la consulta falla: propaga el error (el banner degrada a no-render, candado 9)", async () => {
        mocks.queryRaw.mockRejectedValue(new Error("réplica caída"));
        await expect(getSegmentacion()).rejects.toThrow("réplica caída");
    });
});
