import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
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

describe("/api/colegio/comite/solicitudes", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    async function setupConSolicitud() {
        const { admin, colegio } = await crearColegioConAdmin();
        const comite = await crearComiteCuenta(colegio.id);
        const { alerta, reporte } = await crearAlertaEstudiante(colegio.id);
        const solicitud = await prisma.solicitudComite.create({
            data: {
                reporteId: reporte.id,
                numero: "SOL-CC-TEST",
                estado: "PENDIENTE",
                colegioId: colegio.id,
                alertaColegioId: alerta.id,
                creadoPorId: admin.id,
                motivo: "Escalamiento de prueba",
            },
        });
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        return { admin, colegio, comite, alerta, reporte, solicitud };
    }

    it("lista solo las solicitudes del colegio del comité", async () => {
        await setupConSolicitud();

        const res = await GET(
            new Request("http://localhost:5005/api/colegio/comite/solicitudes", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.items[0].numero).toBe("SOL-CC-TEST");
    });

    it("no permite el acceso con rol SCHOOL_ADMIN", async () => {
        const { admin } = await setupConSolicitud();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/colegio/comite/solicitudes", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(403);
    });
});
