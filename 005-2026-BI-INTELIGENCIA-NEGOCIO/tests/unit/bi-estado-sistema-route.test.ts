// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
    prisma: {
        bIConsultaLog: { findFirst: (a: unknown) => findFirst(a) },
    },
}));

// SPEC-035 · el endpoint ahora exige sesión; los tests de comportamiento usan
// una sesión válida (el 401 sin sesión se cubre en bi-operacion-guard.test.tsx).
vi.mock("@/lib/auth/sesion", () => ({
    sesionDeRequest: async () => ({ id: "u1", rol: "ADMIN" }),
}));

const REQ = new Request("http://localhost/api/bi/estado-sistema");

/* eslint-disable import/first */
import { GET } from "@/app/api/bi/estado-sistema/route";
/* eslint-enable */

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
    fetchSpy.mockReset();
    findFirst.mockReset();
});

function jsonRes(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

type Handler = (url: string) => Response | Promise<Response>;

function porUrl(routes: Record<"vanna" | "superset" | "pi", Handler | Error>) {
    fetchSpy.mockImplementation(async (input: Request | URL | string) => {
        const url = typeof input === "string" ? input : input.toString();
        const key = url.includes("bi-vanna") ? "vanna" : url.includes("bi-superset") ? "superset" : "pi";
        const h = routes[key];
        if (h instanceof Error) throw h;
        return h(url);
    });
}

describe("GET /api/bi/estado-sistema", () => {
    it("vanna 200 + superset ECONNREFUSED + pi 200 → superset.ok=false, otros ok", async () => {
        porUrl({
            vanna: () => jsonRes({ ok: true, modelosDisponibles: [] }),
            superset: new Error("ECONNREFUSED bi-superset"),
            pi: () => jsonRes({ status: "ok" }),
        });
        findFirst.mockResolvedValueOnce({
            id: "log-1",
            estado: "OK",
            creadoEn: new Date("2026-08-29T15:00:00Z"),
            latenciaMs: 4200,
        });
        const res = await GET(REQ);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.vanna.ok).toBe(true);
        expect(body.superset.ok).toBe(false);
        expect(body.superset.error).toBeTruthy();
        expect(body.pi.ok).toBe(true);
        expect(body.ultimoReporte).not.toBeNull();
        expect(body.ultimoReporte.id).toBe("log-1");
    });

    it("prisma throws → ultimoReporte=null + ultimoReporteError, servicios sin afectar", async () => {
        porUrl({
            vanna: () => jsonRes({ ok: true }),
            superset: () => jsonRes({ ok: true }),
            pi: () => jsonRes({ status: "ok" }),
        });
        findFirst.mockRejectedValueOnce(new Error("connection refused"));
        const res = await GET(REQ);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.vanna.ok).toBe(true);
        expect(body.superset.ok).toBe(true);
        expect(body.pi.ok).toBe(true);
        expect(body.ultimoReporte).toBeNull();
        expect(body.ultimoReporteError).toContain("connection refused");
    });

    it("los 3 servicios 200 + BD OK → todo ok, ultimoReporte no null", async () => {
        porUrl({
            vanna: () => jsonRes({ ok: true }),
            superset: () => jsonRes({ ok: true }),
            pi: () => jsonRes({ status: "ok" }),
        });
        findFirst.mockResolvedValueOnce({
            id: "log-9",
            estado: "OK",
            creadoEn: new Date(),
            latenciaMs: 500,
        });
        const res = await GET(REQ);
        const body = await res.json();
        expect(body.vanna.ok && body.superset.ok && body.pi.ok).toBe(true);
        expect(body.ultimoReporte).toMatchObject({ id: "log-9", estado: "OK" });
        expect(body.tsGeneradoEn).toBeTruthy();
    });

    it("los 4 chequeos caen → responde 200 con todo failure (candado 9: sigue viviendo)", async () => {
        porUrl({
            vanna: new Error("net_v"),
            superset: new Error("net_s"),
            pi: new Error("net_p"),
        });
        findFirst.mockRejectedValueOnce(new Error("bd_off"));
        const res = await GET(REQ);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.vanna.ok).toBe(false);
        expect(body.superset.ok).toBe(false);
        expect(body.pi.ok).toBe(false);
        expect(body.ultimoReporte).toBeNull();
        expect(body.ultimoReporteError).toBeTruthy();
    });

    it("HTTP 500 desde superset → ok=false con error http_500", async () => {
        porUrl({
            vanna: () => jsonRes({ ok: true }),
            superset: () => jsonRes({ error: "boom" }, 500),
            pi: () => jsonRes({ status: "ok" }),
        });
        findFirst.mockResolvedValueOnce(null);
        const res = await GET(REQ);
        const body = await res.json();
        expect(body.superset.ok).toBe(false);
        expect(body.superset.error).toBe("http_500");
        expect(body.ultimoReporte).toBeNull();
    });
});
