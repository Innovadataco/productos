import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearReporteVisible(numeroSeguimiento: string, identificador: string, estado = "CLASIFICADO") {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para baja de reporte con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: usuario.id,
            numeroSeguimiento,
            estado: estado as Parameters<typeof prisma.reporte.create>[0]["data"]["estado"],
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS",
            confianza: 0.92,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    const vectorStr = "[" + new Array(768).fill(0.1).join(",") + "]";
    await prisma.$executeRaw`
        INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${reporte.id}, ${vectorStr}::vector, 'nomic-embed-text', NOW())
    `;
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: plataforma!.id } },
        update: { totalReportes: 1, reportesAutenticados: 1, reportesAnonimos: 0, esVisiblePublicamente: false },
        create: {
            identificador,
            plataformaId: plataforma!.id,
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            esVisiblePublicamente: false,
        },
    });
    return reporte;
}

async function crearCorreccionConDataset(reporteId: string, adminId: string) {
    const clasificacion = await prisma.clasificacionIA.findUnique({ where: { reporteId } });
    const correccion = await prisma.correccionAdmin.create({
        data: {
            clasificacionId: clasificacion!.id,
            categoriaOriginal: "OFRECIMIENTO_REGALOS",
            categoriaCorregida: "SOLICITUD_MATERIAL",
            adminId,
            confirmada: false,
        },
    });
    const dataset = await prisma.datasetEntrenamiento.create({
        data: {
            texto: "Texto dataset de prueba",
            clasificacionCorrecta: "SOLICITUD_MATERIAL",
            fuente: "correccion",
            correccionId: correccion.id,
        },
    });
    const vectorStr = "[" + new Array(768).fill(0.2).join(",") + "]";
    await prisma.$executeRaw`
        INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${dataset.id}, ${vectorStr}::vector, 'nomic-embed-text', NOW())
    `;
    return { correccion, dataset };
}

describe("PATCH /api/admin/reportes/[id]/baja", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    it("da de baja un reporte y recalcula score (RETIRO_LIMPIEZA conserva dataset)", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteVisible("RPT-BAJA01", "+57300BAJA01");
        await crearCorreccionConDataset(reporte.id, admin.id);

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/baja`,
            { motivo: "RETIRO_LIMPIEZA", nota: "Solicitud del usuario" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.eliminado).toBe(true);
        expect(body.datasetPurged).toBe(false);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.eliminado).toBe(true);
        expect(actualizado?.motivoBaja).toBe("RETIRO_LIMPIEZA");

        const embedding = await prisma.embeddingReporte.findUnique({ where: { reporteId: reporte.id } });
        expect(embedding).toBeNull();

        const identificador = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: "+57300BAJA01", plataformaId: actualizado!.plataformaId } },
        });
        expect(identificador?.totalReportes).toBe(0);
        expect(identificador?.reportesAutenticados).toBe(0);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "REPORT_DEACTIVATE", recursoId: reporte.id } });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(admin.id);
    });

    it("purga dataset cuando el motivo es REPORTE_FALSO", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteVisible("RPT-BAJA02", "+57300BAJA02");
        const { dataset } = await crearCorreccionConDataset(reporte.id, admin.id);

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/baja`,
            { motivo: "REPORTE_FALSO", nota: "Reporte falso confirmado" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.datasetPurged).toBe(true);

        const datasetActual = await prisma.datasetEntrenamiento.findUnique({ where: { id: dataset.id } });
        expect(datasetActual).toBeNull();
        const embeddingDataset = await prisma.embeddingDataset.findUnique({ where: { datasetId: dataset.id } });
        expect(embeddingDataset).toBeNull();
    });

    it("devuelve 409 si el reporte ya está dado de baja", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteVisible("RPT-BAJA03", "+57300BAJA03");
        await prisma.reporte.update({ where: { id: reporte.id }, data: { eliminado: true } });

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/baja`,
            { motivo: "RETIRO_LIMPIEZA", nota: "x" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(409);
    });

    it("rechaza si el usuario no es admin", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const reporte = await crearReporteVisible("RPT-BAJA04", "+57300BAJA04");

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/baja`,
            { motivo: "RETIRO_LIMPIEZA", nota: "x" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });
});
