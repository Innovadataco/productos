import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { createToken } from "@/lib/auth";

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: () => undefined,
        set: vi.fn(),
    }),
}));

function makeRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/auth/verificar/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function tokenVerificacion(email: string): Promise<string> {
    return createToken({
        sub: email,
        type: "verification",
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
    });
}

describe("POST /api/auth/verificar/completar", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("rechaza 400 sin token ni password (mensaje de contrato)", async () => {
        const res = await POST(makeRequest({}));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Token y contraseña requeridos");
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza 400 una password débil con el mensaje de contrato", async () => {
        const res = await POST(makeRequest({ token: "cualquiera", password: "corta" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Contraseña: mínimo 8 caracteres, 1 letra y 1 número");
    });

    it("rechaza 400 un body que no es un objeto (antes: 500)", async () => {
        const res = await POST(makeRequest(42));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza 400 un token inválido", async () => {
        const res = await POST(makeRequest({ token: "token-falso", password: "Clave1234" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Token inválido o expirado");
    });

    it("crea el usuario con token válido (contrato 201)", async () => {
        const token = await tokenVerificacion("completar-ok@example.com");
        const res = await POST(makeRequest({ token, password: "Clave1234", nombre: "Padre Prueba" }));
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.user.email).toBe("completar-ok@example.com");
        expect(data.user.rol).toBe("PARENT");

        const user = await prisma.usuario.findUnique({ where: { email: "completar-ok@example.com" } });
        expect(user?.nombre).toBe("Padre Prueba");
    });
});
