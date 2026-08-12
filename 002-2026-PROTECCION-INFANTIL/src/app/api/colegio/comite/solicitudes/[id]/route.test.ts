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

describe("/api/colegio/comite/solicitudes/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    async function setup() {
        const { admin, colegio } = await crearColegioConAdmin();
        const comite = await crearComiteCuenta(colegio.id);
        const { alerta, reporte } = await crearAlertaEstudiante(colegio.id);
        const solicitud = await prisma.solicitudComite.create({
            data: {
                reporteId: reporte.id,
                numero: "SOL-CC-DET",
                estado: "PENDIENTE",
                colegioId: colegio.id,
                alertaColegioId: alerta.id,
                creadoPorId: admin.id,
                motivo: "Revisar caso",
            },
        });
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        return { colegio, comite, solicitud };
    }

    it("devuelve el detalle de una solicitud del propio colegio", async () => {
        const { solicitud } = await setup();

        const res = await GET(
            new Request(`http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}`, {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.solicitud.id).toBe(solicitud.id);
        expect(data.caso.alerta).toBeDefined();
    });

    it("devuelve 404 para una solicitud de otro colegio", async () => {
        const { solicitud } = await setup();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroComite = await crearComiteCuenta(otroColegio.id);
        mockToken = await crearTokenUsuario(otroComite.id, "COMITE_CONVIVENCIA");

        const res = await GET(
            new Request(`http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}`, {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(404);
    });
});
