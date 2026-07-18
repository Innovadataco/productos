import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

const mockCookieStore: Record<string, string> = {};

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: (_name: string, _value: string) => {
            // no-op para tests
        },
    }),
}));

describe("POST /api/auth/cambiar-password", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("cambia la contraseña y limpia debeCambiarPassword", async () => {
        const passwordOriginal = "TempPass123";
        const user = await crearUsuario("OPERADOR", undefined, passwordOriginal);
        await prisma.usuario.update({ where: { id: user.id }, data: { debeCambiarPassword: true } });
        mockToken = await crearTokenUsuario(user.id, "OPERADOR");

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/cambiar-password",
            { passwordActual: passwordOriginal, passwordNueva: "NuevaPass456" },
            mockToken
        );

        const res = await POST(req);
        expect(res.status).toBe(200);

        const actualizado = await prisma.usuario.findUnique({ where: { id: user.id } });
        expect(actualizado?.debeCambiarPassword).toBe(false);
        expect(actualizado?.passwordHash).not.toBe(user.passwordHash);
    });

    it("rechaza contraseña actual incorrecta", async () => {
        const user = await crearUsuario("OPERADOR", undefined, "TempPass123");
        mockToken = await crearTokenUsuario(user.id, "OPERADOR");

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/cambiar-password",
            { passwordActual: "MalaPass", passwordNueva: "NuevaPass456" },
            mockToken
        );

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("rechaza sin autenticación", async () => {
        const req = new Request("http://localhost:5005/api/auth/cambiar-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passwordActual: "a", passwordNueva: "b" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("ciclo completo: crear operador → login → cambiar → flag limpio → regenerar → flag true", async () => {
        const { POST: loginPost } = await import("../login/route");
        const { POST: regenerarPost } = await import("../../admin/operadores/[id]/regenerar-password/route");

        const admin = await crearUsuario("ADMIN", "admin-login-test@example.com", "AdminPass123");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        // Crear operador como haría el admin
        const crearReq = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/admin/operadores",
            { email: "operador-ciclo@example.com", nombre: "Operador Ciclo", esRevisorDeApelaciones: false },
            mockToken
        );
        const { POST: crearOperadorPost } = await import("../../admin/operadores/route");
        const crearRes = await crearOperadorPost(crearReq);
        expect(crearRes.status).toBe(200);
        const { operador, passwordTemporal } = await crearRes.json();
        expect(passwordTemporal).toBeDefined();

        // Login con contraseña temporal
        const loginReq = new Request("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "operador-ciclo@example.com", password: passwordTemporal }),
        });
        const loginRes = await loginPost(loginReq);
        expect(loginRes.status).toBe(200);
        const loginData = await loginRes.json();
        expect(loginData.user.debeCambiarPassword).toBe(true);

        // Cambiar contraseña
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const cambiarReq = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/cambiar-password",
            { passwordActual: passwordTemporal, passwordNueva: "NuevaSegura123" },
            mockToken
        );
        const cambiarRes = await POST(cambiarReq);
        expect(cambiarRes.status).toBe(200);

        const despuesCambio = await prisma.usuario.findUnique({ where: { id: operador.id } });
        expect(despuesCambio?.debeCambiarPassword).toBe(false);

        // Admin regenera contraseña → flag vuelve a true
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regenerarReq = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/operadores/${operador.id}/regenerar-password`,
            {},
            mockToken
        );
        const regenerarRes = await regenerarPost(regenerarReq, { params: Promise.resolve({ id: operador.id }) });
        expect(regenerarRes.status).toBe(200);

        const despuesRegenerar = await prisma.usuario.findUnique({ where: { id: operador.id } });
        expect(despuesRegenerar?.debeCambiarPassword).toBe(true);
    });
});
