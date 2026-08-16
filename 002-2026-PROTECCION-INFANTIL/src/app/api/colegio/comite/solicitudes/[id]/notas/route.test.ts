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

describe("/api/colegio/comite/solicitudes/[id]/notas", () => {
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
                numero: "SOL-CC-NOT",
                estado: "PENDIENTE",
                colegioId: colegio.id,
                alertaColegioId: alerta.id,
                creadoPorId: admin.id,
                motivo: "Seguimiento",
            },
        });
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        return { solicitud };
    }

    it("agrega una nota a la bitácora del caso", async () => {
        const { solicitud } = await setup();

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}/notas`,
                { texto: "Se revisó el caso en reunión del comité" },
                mockToken
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.id).toBeDefined();

        const nota = await prisma.notaSeguimiento.findUnique({ where: { id: data.id } });
        expect(nota?.texto).toBe("Se revisó el caso en reunión del comité");
    });
});
