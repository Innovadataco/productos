import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH, DELETE } from "./route";
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

describe("PATCH /api/admin/operadores/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("desactiva un comité y registra COMITE_DESACTIVADO", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite@example.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: comite.id, creadoPorId: admin.id, esComite: true },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost/api/admin/operadores/${comite.id}`,
            { estado: "inactivo" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: comite.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.operador.estado).toBe("inactivo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_DESACTIVADO", recursoId: comite.id },
        });
        expect(audit).not.toBeNull();
    });

    it("reactiva un comité vía PATCH y registra COMITE_ACTIVADO", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await prisma.usuario.create({
            data: {
                email: "comite@example.com",
                nombre: "Comité",
                passwordHash: "hash",
                rol: "COMITE_VALIDACION",
                estado: "inactivo",
            },
        });
        await prisma.perfilOperador.create({
            data: { usuarioId: comite.id, creadoPorId: admin.id, esComite: true },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost/api/admin/operadores/${comite.id}`,
            { estado: "activo" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: comite.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.operador.estado).toBe("activo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_ACTIVADO", recursoId: comite.id },
        });
        expect(audit).not.toBeNull();
    });
});

describe("DELETE /api/admin/operadores/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("inactiva un comité y registra COMITE_DESACTIVADO", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite@example.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: comite.id, creadoPorId: admin.id, esComite: true },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "DELETE",
            `http://localhost/api/admin/operadores/${comite.id}`,
            {},
            mockToken
        );
        const res = await DELETE(req, { params: Promise.resolve({ id: comite.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.operador.estado).toBe("inactivo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_DESACTIVADO", recursoId: comite.id },
        });
        expect(audit).not.toBeNull();
    });
});
