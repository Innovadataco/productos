import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";

const MENSAJE_EXITO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";

const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

function makeRequest(body: unknown, ip = "203.0.113.10"): Request {
    return new Request("http://localhost:5005/api/auth/recuperar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/recuperar/solicitar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        if (rateLimitDisabled) {
            process.env.DISABLE_RATE_LIMIT = "false";
        }
    });

    afterEach(() => {
        if (rateLimitDisabled) {
            process.env.DISABLE_RATE_LIMIT = "true";
        }
    });

    it("rechaza email inválido con VALIDATION_ERROR", async () => {
        const res = await POST(makeRequest({ email: "no-es-email" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("retorna respuesta uniforme para email no registrado", async () => {
        const res = await POST(makeRequest({ email: "no-registrado@example.com" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
        expect(data.emailSent).toBe(false);
    });

    it("retorna respuesta uniforme para email registrado", async () => {
        await crearUsuario("PARENT", "registrado@example.com");
        const res = await POST(makeRequest({ email: "registrado@example.com" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
    });

    it("bloquea tras exceder el límite por IP", async () => {
        const ip = "203.0.113.50";
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email: `ip-${i}@example.com` }, ip));
            expect(res.status).toBe(200);
        }

        const blocked = await POST(makeRequest({ email: "bloqueado@example.com" }, ip));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
        expect(blocked.headers.get("X-RateLimit-Limit")).toBe("5");
        expect(blocked.headers.get("Retry-After")).toBeDefined();
    });

    it("bloquea tras exceder el límite por email", async () => {
        const email = "mismo-email@example.com";
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email }, `203.0.113.${60 + i}`));
            expect(res.status).toBe(200);
        }

        const blocked = await POST(makeRequest({ email }, "203.0.113.99"));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
    });
});
