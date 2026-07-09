import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

describe("POST /api/auth/login", () => {
    const testUser = {
        username: "testuser",
        password: "testpass123",
    };

    beforeAll(async () => {
        // Crear usuario de prueba
        const hashed = await bcrypt.hash(testUser.password, 10);
        await prisma.user.create({
            data: {
                username: testUser.username,
                password: hashed,
                role: "admin",
            },
        });
    });

    afterAll(async () => {
        // Limpiar usuario de prueba
        await prisma.user.deleteMany({ where: { username: testUser.username } });
        await prisma.$disconnect();
    });

    it("debe retornar 401 con credenciales inválidas", async () => {
        const req = new Request("http://localhost:3000/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: "invalid", password: "invalid" }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req as any);
        expect(res.status).toBe(401);
    });

    it("debe retornar 200 con cookie token para credenciales válidas", async () => {
        const req = new Request("http://localhost:3000/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: testUser.username, password: testUser.password }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req as any);
        expect(res.status).toBe(200);

        const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        const hasTokenCookie = cookies.some((c: string) => c.startsWith("token="));
        expect(hasTokenCookie).toBe(true);
    });
});