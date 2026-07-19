import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { encryptParameter, decryptParameter } from "@/lib/param-encryption";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/admin/comite/integrantes", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    async function crearComite(adminId: string) {
        const comite = await crearUsuario("COMITE_VALIDACION", `comite-${Date.now()}@test.com`);
        await prisma.perfilOperador.create({
            data: { usuarioId: comite.id, creadoPorId: adminId, esComite: true },
        });
        return comite;
    }

    it("crea un integrante cifrando el número de identificación", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearComite(admin.id);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/admin/comite/integrantes",
                {
                    comiteId: comite.id,
                    nombres: "Juan",
                    apellidos: "Pérez",
                    tipoIdentificacion: "CEDULA_CIUDADANIA",
                    numeroIdentificacion: "123456789",
                    email: "juan@example.com",
                },
                mockToken
            )
        );

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.integrante.numeroIdentificacion).toBe("123456789");

        const guardado = await prisma.integranteComite.findUnique({ where: { id: data.integrante.id } });
        expect(guardado?.numeroIdentificacion).not.toBe("123456789");
        expect(decryptParameter(guardado!.numeroIdentificacion)).toBe("123456789");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_INTEGRANTE_CREADO", recursoId: data.integrante.id },
        });
        expect(audit).not.toBeNull();
    });

    it("lista integrantes descifrando el número de identificación", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearComite(admin.id);
        await prisma.integranteComite.create({
            data: {
                comiteId: comite.id,
                nombres: "Ana",
                apellidos: "Gómez",
                tipoIdentificacion: "PASAPORTE",
                numeroIdentificacion: encryptParameter("AB123456"),
                email: "ana@example.com",
                creadoPorId: admin.id,
            },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/comite/integrantes?comiteId=${comite.id}`, {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.integrantes).toHaveLength(1);
        expect(data.integrantes[0].numeroIdentificacion).toBe("AB123456");
    });

    it("actualiza un integrante recifrando el número de identificación", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearComite(admin.id);
        const integrante = await prisma.integranteComite.create({
            data: {
                comiteId: comite.id,
                nombres: "Carlos",
                apellidos: "Ruiz",
                tipoIdentificacion: "CEDULA_EXTRANJERIA",
                numeroIdentificacion: encryptParameter("CE987654"),
                email: "carlos@example.com",
                creadoPorId: admin.id,
            },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await PATCH(
            crearRequestAutenticado(
                "PATCH",
                `http://localhost:5005/api/admin/comite/integrantes/${integrante.id}`,
                { numeroIdentificacion: "CE111111" },
                mockToken
            ),
            { params: Promise.resolve({ id: integrante.id }) }
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.integrante.numeroIdentificacion).toBe("CE111111");

        const guardado = await prisma.integranteComite.findUnique({ where: { id: integrante.id } });
        expect(decryptParameter(guardado!.numeroIdentificacion)).toBe("CE111111");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_INTEGRANTE_ACTUALIZADO", recursoId: integrante.id },
        });
        expect(audit).not.toBeNull();
    });

    it("inactiva un integrante y setea fechaFin", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearComite(admin.id);
        const integrante = await prisma.integranteComite.create({
            data: {
                comiteId: comite.id,
                nombres: "Luis",
                apellidos: "Martínez",
                tipoIdentificacion: "OTRO",
                numeroIdentificacion: encryptParameter("ID000"),
                email: "luis@example.com",
                creadoPorId: admin.id,
            },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await DELETE(
            crearRequestAutenticado(
                "DELETE",
                `http://localhost:5005/api/admin/comite/integrantes/${integrante.id}`,
                {},
                mockToken
            ),
            { params: Promise.resolve({ id: integrante.id }) }
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.integrante.estado).toBe("INACTIVO");
        expect(data.integrante.fechaFin).not.toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_INTEGRANTE_INACTIVADO", recursoId: integrante.id },
        });
        expect(audit).not.toBeNull();
    });
});
