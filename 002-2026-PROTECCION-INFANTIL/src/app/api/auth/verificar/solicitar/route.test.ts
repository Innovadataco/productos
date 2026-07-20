import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";

const MENSAJE_EXITO = "Si el email es válido, recibirás un código de verificación.";

const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

function makeRequest(body: unknown, ip = "203.0.113.20"): Request {
    return new Request("http://localhost:5005/api/auth/verificar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/verificar/solicitar", () => {
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

    it("rechaza email inválido", async () => {
        const res = await POST(makeRequest({ email: "no-es-email" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("retorna respuesta uniforme para email registrado", async () => {
        await crearUsuario("PARENT", "registrado-verificar@example.com");
        const res = await POST(makeRequest({ email: "registrado-verificar@example.com" }));
        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
    });

    it("genera código para email no registrado", async () => {
        const res = await POST(makeRequest({ email: "nuevo-verificar@example.com" }));
        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.emailSent).toBe(false);
        expect(data.devCode).toBeDefined();

        const codes = await prisma.codigoVerificacion.count({
            where: { email: "nuevo-verificar@example.com" },
        });
        expect(codes).toBe(1);
    });

    it("bloquea tras exceder el límite por IP", async () => {
        const ip = "203.0.113.70";
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email: `ip-${i}@example.com` }, ip));
            expect(res.status).toBe(202);
        }

        const blocked = await POST(makeRequest({ email: "bloqueado@example.com" }, ip));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
        expect(blocked.headers.get("X-RateLimit-Limit")).toBe("5");
    });

    it("bloquea tras exceder el límite por email", async () => {
        // Se usa un email registrado para que el endpoint no cree códigos
        // y el único límite aplicable sea el rate limit por identificador.
        const email = "registrado-rl-email@example.com";
        await crearUsuario("PARENT", email);
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email }, `203.0.113.${80 + i}`));
            expect(res.status).toBe(202);
        }

        const blocked = await POST(makeRequest({ email }, "203.0.113.99"));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
    });
});
