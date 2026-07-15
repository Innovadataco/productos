import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, getClientIp, resetRateLimitStore } from "./rate-limit";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { crearParametrosReportes } from "./reporte-test-utils";

function makeRequest(ip: string): Request {
    return new Request("http://localhost:5005/api/test", {
        headers: { "x-forwarded-for": ip },
    });
}

describe("getClientIp", () => {
    it("lee x-forwarded-for", () => {
        const req = makeRequest("1.2.3.4");
        expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("devuelve unknown sin cabeceras", () => {
        const req = new Request("http://localhost:5005/api/test");
        expect(getClientIp(req)).toBe("unknown");
    });
});

describe("checkRateLimit", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
    });

    it("permite la primera petición y devuelve headers", async () => {
        const result = await checkRateLimit(makeRequest("10.0.0.1"), "consulta");
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(29);
        expect(result.headers["X-RateLimit-Limit"]).toBe("30");
        expect(result.headers["X-RateLimit-Remaining"]).toBe("29");
        expect(result.headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("bloquea tras exceder el límite", async () => {
        const ip = "10.0.0.2";
        for (let i = 0; i < 30; i++) {
            const result = await checkRateLimit(makeRequest(ip), "consulta");
            expect(result.allowed).toBe(true);
        }
        const blocked = await checkRateLimit(makeRequest(ip), "consulta");
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);
        expect(blocked.headers["Retry-After"]).toBeDefined();
    });

    it("reinicia el contador en una nueva ventana", async () => {
        const ip = "10.0.0.3";
        // Sobrepasar límite
        for (let i = 0; i < 30; i++) {
            await checkRateLimit(makeRequest(ip), "consulta");
        }
        const blocked = await checkRateLimit(makeRequest(ip), "consulta");
        expect(blocked.allowed).toBe(false);

        // Simular ventana nueva eliminando la fila actual
        await prisma.rateLimit.deleteMany({ where: { scope: "consulta", identifier: ip } });

        const fresh = await checkRateLimit(makeRequest(ip), "consulta");
        expect(fresh.allowed).toBe(true);
        expect(fresh.remaining).toBe(29);
    });

    it("usa identificador personalizado cuando se proporciona", async () => {
        const userId = "user-123";
        const req = new Request("http://localhost:5005/api/test");
        for (let i = 0; i < 5; i++) {
            const result = await checkRateLimit(req, "report", { identifier: userId });
            expect(result.allowed).toBe(true);
        }
        const blocked = await checkRateLimit(req, "report", { identifier: userId });
        expect(blocked.allowed).toBe(false);

        // Otra IP sin identificador explícito no debería estar bloqueada
        const other = await checkRateLimit(makeRequest("10.0.0.4"), "report");
        expect(other.allowed).toBe(true);
    });
});
