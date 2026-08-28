import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { verifyToken } from "@/lib/auth/jwt";

const TEST_SECRET = "test-secret-local-bi-spec001";

async function makeToken(secret: string, payload: Record<string, unknown> = {}) {
    return new SignJWT({ role: "ADMIN", ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(secret));
}

beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
});

describe("verifyToken", () => {
    it("retorna payload con token firmado con el secret correcto", async () => {
        const token = await makeToken(TEST_SECRET);
        const payload = await verifyToken(token);
        expect(payload).not.toBeNull();
        expect(payload?.role).toBe("ADMIN");
    });

    it("retorna null con secret incorrecto", async () => {
        const token = await makeToken("otro-secret-diferente");
        const result = await verifyToken(token);
        expect(result).toBeNull();
    });

    it("retorna null si JWT_SECRET no está definido", async () => {
        const original = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        const token = await makeToken(TEST_SECRET);
        const result = await verifyToken(token);
        expect(result).toBeNull();
        process.env.JWT_SECRET = original;
    });
});
