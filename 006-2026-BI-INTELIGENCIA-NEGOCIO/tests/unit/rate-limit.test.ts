// tests/unit/rate-limit.test.ts · Freno anti fuerza bruta del login (auditoría SEG)
// Producto 006 · BI v2
// Cubre: ventana fija de 10/5min por IP, rechazo con 429 + Retry-After,
// fail-CLOSED del scope login cuando el store está caído y bypass con
// DISABLE_RATE_LIMIT=true. Unitarios puros: sin BD (cliente inyectado).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const mocksConfig = vi.hoisted(() => ({
    getConfig: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ getConfig: mocksConfig.getConfig }));

import { checkRateLimit } from "@/lib/rate-limit";

/** PrismaClient falso que devuelve `counts` en secuencia para cada $queryRaw. */
function clienteCon(counts: number[], lanzar?: Error): PrismaClient {
    let i = 0;
    return {
        $queryRaw: vi.fn(() => {
            if (lanzar) return Promise.reject(lanzar);
            const count = counts[Math.min(i, counts.length - 1)];
            i += 1;
            return Promise.resolve([{ count }]);
        }),
        $executeRaw: vi.fn().mockResolvedValue(0),
    } as unknown as PrismaClient;
}

function requestDe(ip: string): Request {
    return new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
    });
}

describe("checkRateLimit · freno del login", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocksConfig.getConfig.mockResolvedValue(null); // sin overrides → defaults
        vi.spyOn(Math, "random").mockReturnValue(0.99); // nunca limpia ventanas
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.DISABLE_RATE_LIMIT;
    });

    it("permite hasta el décimo intento y gasta el contador SIEMPRE", async () => {
        const cliente = clienteCon([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        for (let n = 1; n <= 10; n += 1) {
            const r = await checkRateLimit(requestDe("10.0.0.1"), "login", { client: cliente });
            expect(r.allowed).toBe(true);
            expect(r.remaining).toBe(10 - n);
        }
        expect(cliente.$queryRaw).toHaveBeenCalledTimes(10);
    });

    it("rechaza el undécimo con Retry-After y encabezados de ventana", async () => {
        const cliente = clienteCon([11]);
        const r = await checkRateLimit(requestDe("10.0.0.2"), "login", { client: cliente });
        expect(r.allowed).toBe(false);
        expect(r.limit).toBe(10);
        expect(r.remaining).toBe(0);
        expect(Number(r.headers["Retry-After"])).toBeGreaterThan(0);
        expect(r.headers["X-RateLimit-Limit"]).toBe("10");
        expect(cliente.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("usa la IP del cliente (x-forwarded-for) como identificador de la ventana", async () => {
        const cliente = clienteCon([1]);
        await checkRateLimit(requestDe("203.0.113.7"), "login", { client: cliente });
        const raw = vi.mocked(cliente.$queryRaw).mock.calls[0][0] as unknown as { sql: string };
        expect(raw.sql).toContain("login:203.0.113.7:");
    });

    it("fail-CLOSED: si el store está caído, el login se niega (429), no pasa", async () => {
        const cliente = clienteCon([], new Error("connection refused"));
        const r = await checkRateLimit(requestDe("10.0.0.3"), "login", { client: cliente });
        expect(r.allowed).toBe(false);
        expect(Number(r.headers["Retry-After"])).toBeGreaterThan(0);
    });

    it("DISABLE_RATE_LIMIT=true deja pasar sin tocar el store", async () => {
        process.env.DISABLE_RATE_LIMIT = "true";
        const cliente = clienteCon([]);
        const r = await checkRateLimit(requestDe("10.0.0.4"), "login", { client: cliente });
        expect(r.allowed).toBe(true);
        expect(cliente.$queryRaw).not.toHaveBeenCalled();
    });

    it("honra el override de bi_config (ratelimit.login.max_requests)", async () => {
        mocksConfig.getConfig.mockImplementation((clave: string) =>
            Promise.resolve(clave === "ratelimit.login.max_requests" ? "3" : null),
        );
        const cliente = clienteCon([4]);
        const r = await checkRateLimit(requestDe("10.0.0.5"), "login", { client: cliente });
        expect(r.allowed).toBe(false);
        expect(r.limit).toBe(3);
    });
});
