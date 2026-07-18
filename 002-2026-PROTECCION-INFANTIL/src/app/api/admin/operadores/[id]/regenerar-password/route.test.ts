import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("POST /api/admin/operadores/[id]/regenerar-password", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("regenera contraseña temporal y marca debeCambiarPassword", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost/api/admin/operadores/${operador.id}/regenerar-password`,
            {},
            mockToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: operador.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.passwordTemporal).toBeDefined();
        expect(data.passwordTemporal.length).toBeGreaterThanOrEqual(8);
        expect(data.operador.debeCambiarPassword).toBe(true);

        const actualizado = await prisma.usuario.findUnique({ where: { id: operador.id } });
        expect(actualizado?.debeCambiarPassword).toBe(true);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "OPERADOR_PASSWORD_REGENERADA", recursoId: operador.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(admin.id);
    });

    it("rechaza si no es admin", async () => {
        const noAdmin = await crearUsuario("PARENT");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        mockToken = await crearTokenUsuario(noAdmin.id, "PARENT");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost/api/admin/operadores/${operador.id}/regenerar-password`,
            {},
            mockToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: operador.id }) });
        expect(res.status).toBe(403);
    });
});
