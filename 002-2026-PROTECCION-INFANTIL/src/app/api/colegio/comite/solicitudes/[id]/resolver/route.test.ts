import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta, crearAlertaEstudiante } from "@/lib/comite-test-utils";
import { hashIdentificacion } from "@/lib/hash-identificacion";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearIntegrante(comiteId: string, doc: string, estado: "ACTIVO" | "INACTIVO" = "ACTIVO") {
    return prisma.integranteComite.create({
        data: {
            comiteId,
            nombres: "Ana",
            apellidos: "Firmante",
            tipoIdentificacion: "CEDULA_CIUDADANIA",
            numeroIdentificacion: doc,
            hashIdentificacion: hashIdentificacion(doc),
            email: `integrante-${doc}@test.com`,
            estado,
            creadoPorId: comiteId,
        },
    });
}

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

    it("SPEC-319 §2.4: resuelve con firmante activo → registra firmante en caso y audit", async () => {
        const { comite, solicitud, alerta } = await setup();
        const firmante = await crearIntegrante(comite.id, "111");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}/resolver`,
                { resolucion: "El comité decide activar protocolo de acompañamiento", integranteFirmanteId: firmante.id },
                mockToken
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.solicitud.estado).toBe("RESUELTA");

        // La firma queda en el caso.
        const solDb = await prisma.solicitudComite.findUnique({ where: { id: solicitud.id } });
        expect(solDb?.integranteFirmanteId).toBe(firmante.id);

        const alertaActualizada = await prisma.alertaColegio.findUnique({ where: { id: alerta.id } });
        expect(alertaActualizada?.estado).toBe("gestionada");

        // Y en la auditoría, con el nombre del firmante.
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CASO_RESUELTO_POR_COMITE" },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorNuevo).toContain(firmante.id);
    });

    it("SPEC-319 §2.4: rechaza firmante INACTIVO", async () => {
        const { comite, solicitud } = await setup();
        const inactivo = await crearIntegrante(comite.id, "222", "INACTIVO");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}/resolver`,
                { resolucion: "Decisión", integranteFirmanteId: inactivo.id },
                mockToken
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(400);
        // No se resolvió.
        const solDb = await prisma.solicitudComite.findUnique({ where: { id: solicitud.id } });
        expect(solDb?.estado).toBe("PENDIENTE");
    });

    it("SPEC-319 §2.4: rechaza firmante de otro comité", async () => {
        const { solicitud } = await setup();
        // Integrante de un comité de OTRO colegio.
        const otro = await crearColegioConAdmin();
        const otroComite = await crearComiteCuenta(otro.colegio.id);
        const ajeno = await crearIntegrante(otroComite.id, "333");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}/resolver`,
                { resolucion: "Decisión", integranteFirmanteId: ajeno.id },
                mockToken
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(400);
    });

    it("rechaza resolver una solicitud ya resuelta", async () => {
        const { comite, solicitud } = await setup();
        const firmante = await crearIntegrante(comite.id, "444");
        await prisma.solicitudComite.update({
            where: { id: solicitud.id },
            data: { estado: "RESUELTA", resolucion: "Ya resuelta", resueltoEn: new Date() },
        });

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                `http://localhost:5005/api/colegio/comite/solicitudes/${solicitud.id}/resolver`,
                { resolucion: "Otra", integranteFirmanteId: firmante.id },
                mockToken
            ),
            { params: Promise.resolve({ id: solicitud.id }) }
        );

        expect(res.status).toBe(409);
    });
});
