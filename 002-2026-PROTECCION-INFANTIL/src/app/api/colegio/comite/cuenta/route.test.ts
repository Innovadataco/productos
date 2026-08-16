import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin } from "@/lib/comite-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/colegio/comite/cuenta", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("retorna null cuando el colegio aún no tiene cuenta de comité", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/colegio/comite/cuenta", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.cuenta).toBeNull();
    });

    it("crea la cuenta del comité y devuelve contraseña temporal", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta",
                { email: "comite@colegio.test" },
                mockToken
            )
        );

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.cuenta.email).toBe("comite@colegio.test");
        expect(data.cuenta.estado).toBe("activo");
        expect(data.passwordTemporal).toHaveLength(12);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_COMITE_CREADO" },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza crear una segunda cuenta para el mismo colegio", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await prisma.usuario.create({
            data: {
                email: "existente@colegio.test",
                passwordHash: "x",
                rol: "COMITE_CONVIVENCIA",
                estado: "activo",
                comiteColegioId: colegio.id,
            },
        });

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta",
                { email: "nueva@colegio.test" },
                mockToken
            )
        );

        expect(res.status).toBe(409);
    });

    it("rechaza un email ya usado por otro usuario", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await prisma.usuario.create({
            data: { email: "usado@test.com", passwordHash: "x", rol: "PARENT", estado: "activo" },
        });

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta",
                { email: "usado@test.com" },
                mockToken
            )
        );

        expect(res.status).toBe(409);
    });
});
