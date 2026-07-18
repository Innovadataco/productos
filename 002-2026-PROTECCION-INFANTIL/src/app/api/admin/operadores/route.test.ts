import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/email", () => ({
    enviarEmailBienvenidaOperador: vi.fn().mockResolvedValue(undefined),
}));

describe("/api/admin/operadores", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea un miembro del comité con esComite=true", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "comite@test.com",
                    nombre: "Miembro Comité",
                    rol: "COMITE_VALIDACION",
                }),
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.operador.rol).toBe("COMITE_VALIDACION");
        expect(json.operador.perfil.esComite).toBe(true);

        const usuario = await prisma.usuario.findUnique({
            where: { id: json.operador.id },
            include: { perfilOperador: true },
        });
        expect(usuario?.perfilOperador?.esComite).toBe(true);
    });

    it("rechaza crear OPERADOR con esComite=true", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "op@test.com",
                    nombre: "Operador",
                    rol: "OPERADOR",
                    esComite: true,
                }),
            })
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe("EXCLUSIVIDAD_ROL");
    });

    it("lista operadores y miembros del comité", async () => {
        const admin = await crearUsuario("ADMIN");
        const op = await crearUsuario("OPERADOR", "op@test.com");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite@test.com");
        await prisma.perfilOperador.createMany({
            data: [
                { usuarioId: op.id, creadoPorId: admin.id, cupoMaximo: 10, esComite: false },
                { usuarioId: comite.id, creadoPorId: admin.id, cupoMaximo: 10, esComite: true },
            ],
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/operadores", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.operadores).toHaveLength(2);
        expect(json.operadores.map((o: { rol: string }) => o.rol).sort()).toEqual(["COMITE_VALIDACION", "OPERADOR"]);
    });
});
