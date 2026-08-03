import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

function makeRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/auth/verificar/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function crearCodigo(email: string, codigo: string) {
    await prisma.codigoVerificacion.create({
        data: {
            email,
            codigoHash: await bcrypt.hash(codigo, 12),
            expiraEn: new Date(Date.now() + 15 * 60 * 1000),
        },
    });
}

describe("POST /api/auth/verificar/validar", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("rechaza 400 un código que no tiene 6 dígitos (mensaje de contrato)", async () => {
        const res = await POST(makeRequest({ email: "a@example.com", codigo: "123" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Email y código de 6 dígitos requeridos");
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza 400 sin email", async () => {
        const res = await POST(makeRequest({ codigo: "123456" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Email y código de 6 dígitos requeridos");
    });

    it("rechaza 400 un body que no es un objeto (antes: 500)", async () => {
        const res = await POST(makeRequest("no-soy-un-objeto"));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza un código incorrecto y cuenta el intento", async () => {
        await crearCodigo("validar-incorrecto@example.com", "123456");
        const res = await POST(makeRequest({ email: "validar-incorrecto@example.com", codigo: "654321" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Código incorrecto");

        const record = await prisma.codigoVerificacion.findFirst({
            where: { email: "validar-incorrecto@example.com" },
        });
        expect(record?.intentosFallidos).toBe(1);
    });

    it("valida el código correcto y emite token temporal (contrato 200)", async () => {
        await crearCodigo("validar-ok@example.com", "123456");
        const res = await POST(makeRequest({ email: " VALIDAR-OK@example.com ", codigo: "123456" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.valido).toBe(true);
        expect(typeof data.token).toBe("string");

        const record = await prisma.codigoVerificacion.findFirst({
            where: { email: "validar-ok@example.com" },
        });
        expect(record?.usado).toBe(true);
    });
});
