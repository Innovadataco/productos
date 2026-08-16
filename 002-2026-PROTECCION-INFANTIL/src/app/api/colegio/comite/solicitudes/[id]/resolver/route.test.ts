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

describe("/api/colegio/comite/solicitudes/[id]/resolver", () => {
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
                numero: "SOL-CC-RES",
                estado: "PENDIENTE",
                colegioId: colegio.id,
                alertaColegioId: alerta.id,
                creadoPorId: admin.id,
                motivo: "Resolver",
            },
        });
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        return { colegio, comite, solicitud, alerta };
    }

    it("resuelve una solicitud y marca la alerta como gestionada", async () => {
        const { solicitud, alerta } = await setup();

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}/resolver`,
                { resolucion: "El comité decide activar protocolo de acompañamiento" },
                mockToken
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.solicitud.estado).toBe("RESUELTA");

        const alertaActualizada = await prisma.alertaColegio.findUnique({ where: { id: alerta.id } });
        expect(alertaActualizada?.estado).toBe("gestionada");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CASO_RESUELTO_POR_COMITE" },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza resolver una solicitud ya resuelta", async () => {
        const { solicitud } = await setup();
        await prisma.solicitudComite.update({
            where: { id: solicitud.id },
            data: { estado: "RESUELTA", resolucion: "Ya resuelta", resueltoEn: new Date() },
        });

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}/resolver`,
                { resolucion: "Otra" },
                mockToken
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(409);
    });
});
