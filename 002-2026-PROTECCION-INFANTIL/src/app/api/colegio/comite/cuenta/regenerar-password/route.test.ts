import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta } from "@/lib/comite-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/colegio/comite/cuenta/regenerar-password", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("regenera la contraseña de la cuenta del comité", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        await crearComiteCuenta(colegio.id, "comite@colegio.test");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta/regenerar-password",
                {},
                mockToken
            )
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.cuenta.email).toBe("comite@colegio.test");
        expect(data.cuenta.debeCambiarPassword).toBe(true);
        expect(data.passwordTemporal).toHaveLength(12);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_COMITE_PASSWORD_REGENERADA" },
        });
        expect(audit).not.toBeNull();
    });

    it("devuelve 404 si no existe la cuenta del comité", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta/regenerar-password",
                {},
                mockToken
            )
        );

        expect(res.status).toBe(404);
    });
});
