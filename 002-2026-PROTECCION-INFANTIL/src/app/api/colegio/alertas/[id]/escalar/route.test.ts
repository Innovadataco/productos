import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta, crearAlertaEstudiante } from "@/lib/comite-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/colegio/alertas/[id]/escalar", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    async function setup() {
        const { admin, colegio } = await crearColegioConAdmin();
        await crearComiteCuenta(colegio.id);
        const { alerta } = await crearAlertaEstudiante(colegio.id);
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        return { admin, colegio, alerta };
    }

    it("escala una alerta al comité creando una solicitud", async () => {
        const { alerta } = await setup();

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/escalar`,
                { motivo: "Requiere decisión del comité" },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.solicitud.estado).toBe("PENDIENTE");
        expect(data.alerta.estado).toBe("escalada");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CASO_ESCALADO_A_COMITE" },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza escalar una alerta ya escalada", async () => {
        const { alerta } = await setup();
        await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/escalar`,
                { motivo: "Primera vez" },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/escalar`,
                { motivo: "Segunda vez" },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );

        expect(res.status).toBe(409);
    });

    it("rechaza escalar una alerta de otro colegio", async () => {
        const { alerta } = await setup();
        const { admin: otroAdmin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(otroAdmin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/escalar`,
                { motivo: "Intento ajeno" },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );

        expect(res.status).toBe(404);
    });

    it("rechaza escalar si no existe la cuenta del comité", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const { alerta } = await crearAlertaEstudiante(colegio.id);
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/alertas/${alerta.id}/escalar`,
                { motivo: "Sin comité" },
                mockToken
            ),
            { params: Promise.resolve({ id: alerta.id }) }
        );

        expect(res.status).toBe(400);
    });
});
