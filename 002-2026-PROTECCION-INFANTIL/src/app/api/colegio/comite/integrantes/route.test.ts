import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";
import { PATCH as PATCH_ESTADO } from "./[id]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta } from "@/lib/comite-test-utils";
import { encryptParameter, decryptParameter } from "@/lib/param-encryption";
import { hashIdentificacion } from "@/lib/hash-identificacion";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/colegio/comite/integrantes", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    async function setupConCuenta() {
        const { admin, colegio } = await crearColegioConAdmin();
        const comite = await crearComiteCuenta(colegio.id);
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        return { admin, colegio, comite };
    }

    it("crea un integrante cifrando el número de identificación", async () => {
        await setupConCuenta();

        const res = await POST(
            crearRequestAutenticado("POST", "http://localhost:5005/api/colegio/comite/integrantes", {
                nombres: "Juan",
                apellidos: "Pérez",
                tipoIdentificacion: "CEDULA_CIUDADANIA",
                numeroIdentificacion: "123456789",
                email: "juan@example.com",
                cargo: "Rector",
            }, mockToken)
        );

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.integrante.numeroIdentificacion).toBe("123456789");

        const guardado = await prisma.integranteComite.findUnique({ where: { id: data.integrante.id } });
        expect(guardado).not.toBeNull();
        expect(decryptParameter(guardado!.numeroIdentificacion)).toBe("123456789");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_COMITE_INTEGRANTE_CREADO" },
        });
        expect(audit).not.toBeNull();
    });

    it("lista integrantes descifrando el documento", async () => {
        const { comite } = await setupConCuenta();
        await prisma.integranteComite.create({
            data: {
                comiteId: comite.id,
                nombres: "Ana",
                apellidos: "Gómez",
                tipoIdentificacion: "PASAPORTE",
                numeroIdentificacion: encryptParameter("AB123456"),
                hashIdentificacion: hashIdentificacion("AB123456"),
                email: "ana@example.com",
                cargo: "Psicóloga",
                creadoPorId: comite.id,
            },
        });

        const res = await GET(
            new Request("http://localhost:5005/api/colegio/comite/integrantes", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.integrantes).toHaveLength(1);
    });

    it("rechaza un documento duplicado en el mismo comité", async () => {
        const { comite } = await setupConCuenta();
        await prisma.integranteComite.create({
            data: {
                comiteId: comite.id,
                nombres: "Ana",
                apellidos: "Gómez",
                tipoIdentificacion: "PASAPORTE",
                numeroIdentificacion: encryptParameter("AB123456"),
                hashIdentificacion: hashIdentificacion("AB123456"),
                email: "ana@example.com",
                cargo: "Psicóloga",
                creadoPorId: comite.id,
            },
        });

        const res = await POST(
            crearRequestAutenticado("POST", "http://localhost:5005/api/colegio/comite/integrantes", {
                nombres: "Otra",
                apellidos: "Persona",
                tipoIdentificacion: "PASAPORTE",
                numeroIdentificacion: "AB123456",
                email: "otra@example.com",
                cargo: "Docente",
            }, mockToken)
        );

        expect(res.status).toBe(409);
    });

    it("actualiza el cargo de un integrante", async () => {
        const { comite } = await setupConCuenta();
        const integrante = await prisma.integranteComite.create({
            data: {
                comiteId: comite.id,
                nombres: "Luis",
                apellidos: "Martínez",
                tipoIdentificacion: "OTRO",
                numeroIdentificacion: encryptParameter("ID000"),
                hashIdentificacion: hashIdentificacion("ID000"),
                email: "luis@example.com",
                cargo: "Docente",
                creadoPorId: comite.id,
            },
        });

        const res = await PATCH(
            crearRequestAutenticado(
                "PATCH",
                `http://localhost:5005/api/colegio/comite/integrantes/${integrante.id}`,
                { cargo: "Coordinador" },
                mockToken
            ),
            { params: Promise.resolve({ id: integrante.id }) }
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.integrante.cargo).toBe("Coordinador");
    });

    it("inactiva y reactiva un integrante", async () => {
        const { comite } = await setupConCuenta();
        const integrante = await prisma.integranteComite.create({
            data: {
                comiteId: comite.id,
                nombres: "Luis",
                apellidos: "Martínez",
                tipoIdentificacion: "OTRO",
                numeroIdentificacion: encryptParameter("ID000"),
                hashIdentificacion: hashIdentificacion("ID000"),
                email: "luis@example.com",
                cargo: "Docente",
                creadoPorId: comite.id,
            },
        });

        const res1 = await PATCH_ESTADO(
            crearRequestAutenticado(
                "PATCH",
                `http://localhost:5005/api/colegio/comite/integrantes/${integrante.id}/estado`,
                { estado: "INACTIVO" },
                mockToken
            ),
            { params: Promise.resolve({ id: integrante.id }) }
        );

        expect(res1.status).toBe(200);
        const data1 = await res1.json();
        expect(data1.integrante.estado).toBe("INACTIVO");
        expect(data1.integrante.fechaFin).not.toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_COMITE_INTEGRANTE_INACTIVADO" },
        });
        expect(audit).not.toBeNull();

        const res2 = await PATCH_ESTADO(
            crearRequestAutenticado(
                "PATCH",
                `http://localhost:5005/api/colegio/comite/integrantes/${integrante.id}/estado`,
                { estado: "ACTIVO" },
                mockToken
            ),
            { params: Promise.resolve({ id: integrante.id }) }
        );

        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.integrante.estado).toBe("ACTIVO");
        expect(data2.integrante.fechaFin).toBeNull();
    });
});
