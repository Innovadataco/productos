import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sesionMock = vi.fn();
const queryRawMock = vi.fn();
vi.mock("@/lib/auth/sesion", () => ({
    sesionDeRequest: (r: Request) => sesionMock(r),
}));
vi.mock("@/lib/prisma", () => ({
    prisma: {
        $queryRaw: (...args: unknown[]) => queryRawMock(...args),
    },
}));

const fetchOrig = global.fetch;

beforeEach(() => {
    sesionMock.mockReset();
    queryRawMock.mockReset();
});

afterEach(() => {
    global.fetch = fetchOrig;
});

async function loadRoute() {
    return await import("@/app/api/bi/kpis/route");
}

function makeReq() {
    return new Request("http://localhost/api/bi/kpis");
}

describe("GET /api/bi/kpis", () => {
    it("401 sin sesión", async () => {
        sesionMock.mockResolvedValue(null);
        const { GET } = await loadRoute();
        const r = await GET(makeReq());
        expect(r.status).toBe(401);
        const body = await r.json();
        expect(body.error).toBe("unauthorized");
    });

    it("200 con shape completo cuando todas las queries traen datos", async () => {
        sesionMock.mockResolvedValue({ id: "u1", rol: "ADMIN" });
        // 5 queries en orden: reportes24h, alertas, colegios, susc, mrr
        queryRawMock
            .mockResolvedValueOnce([{ v: BigInt(42) }])
            .mockResolvedValueOnce([{ v: BigInt(5) }])
            .mockResolvedValueOnce([{ v: BigInt(3) }])
            .mockResolvedValueOnce([{ v: BigInt(7) }])
            .mockResolvedValueOnce([{ v: 1500000 }]);
        global.fetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), { status: 200 }),
        ) as unknown as typeof fetch;
        const { GET } = await loadRoute();
        const r = await GET(makeReq());
        expect(r.status).toBe(200);
        const body = await r.json();
        expect(body.kpis.reportes24h.valor).toBe(42);
        expect(body.kpis.alertasActivas.valor).toBe(5);
        expect(body.kpis.colegiosActivos.valor).toBe(3);
        expect(body.kpis.suscActivas.valor).toBe(7);
        expect(body.kpis.mrrMesActualCop.valor).toBe(1500000);
        expect(body.kpis.uptime.biNext.ok).toBe(true);
        expect(body.kpis.uptime.biVanna.ok).toBe(true);
        expect(body.kpis.uptime.piApp.ok).toBe(true);
    });

    it("valor=null cuando la MV devuelve 0 filas (candado 9)", async () => {
        sesionMock.mockResolvedValue({ id: "u1", rol: "ADMIN" });
        queryRawMock.mockResolvedValue([{ v: BigInt(0) }]);
        global.fetch = vi.fn().mockResolvedValue(
            new Response("{}", { status: 200 }),
        ) as unknown as typeof fetch;
        const { GET } = await loadRoute();
        const r = await GET(makeReq());
        expect(r.status).toBe(200);
        const body = await r.json();
        expect(body.kpis.reportes24h.valor).toBeNull();
        expect(body.kpis.alertasActivas.valor).toBeNull();
        expect(body.kpis.colegiosActivos.valor).toBeNull();
        expect(body.kpis.mrrMesActualCop.valor).toBeNull();
    });

    it("endpoint responde 200 aunque una query lance excepción", async () => {
        sesionMock.mockResolvedValue({ id: "u1", rol: "ADMIN" });
        queryRawMock
            .mockResolvedValueOnce([{ v: BigInt(10) }])
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValueOnce([{ v: BigInt(2) }])
            .mockResolvedValueOnce([{ v: BigInt(4) }])
            .mockResolvedValueOnce([{ v: 500000 }]);
        global.fetch = vi.fn().mockResolvedValue(
            new Response("{}", { status: 200 }),
        ) as unknown as typeof fetch;
        const { GET } = await loadRoute();
        const r = await GET(makeReq());
        expect(r.status).toBe(200);
        const body = await r.json();
        expect(body.kpis.reportes24h.valor).toBe(10);
        expect(body.kpis.alertasActivas.valor).toBeNull();
        expect(body.kpis.colegiosActivos.valor).toBe(2);
    });

    it("uptime.biVanna.ok=false cuando el fetch aborta por timeout", async () => {
        sesionMock.mockResolvedValue({ id: "u1", rol: "ADMIN" });
        queryRawMock.mockResolvedValue([{ v: BigInt(1) }]);
        // Simular fetch que rechaza (equivalente a AbortController fired)
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("bi-vanna")) {
                return Promise.reject(new Error("aborted"));
            }
            return Promise.resolve(new Response("{}", { status: 200 }));
        }) as unknown as typeof fetch;
        const { GET } = await loadRoute();
        const r = await GET(makeReq());
        expect(r.status).toBe(200);
        const body = await r.json();
        expect(body.kpis.uptime.biVanna.ok).toBe(false);
        expect(body.kpis.uptime.biVanna.error).toBe("aborted");
        expect(body.kpis.uptime.piApp.ok).toBe(true); // el otro sí responde
    });
});
