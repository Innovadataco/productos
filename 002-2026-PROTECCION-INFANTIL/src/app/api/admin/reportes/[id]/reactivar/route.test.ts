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

const mockEmbedding = vi.fn();
vi.mock("@/lib/ai/embedder", () => ({
    generarEmbedding: (...args: unknown[]) => mockEmbedding(...args),
}));

async function crearReporteDadoDeBaja(numeroSeguimiento: string, identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para reactivación de reporte con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: usuario.id,
            numeroSeguimiento,
            estado: "CLASIFICADO",
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
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: plataforma!.id } },
        update: { totalReportes: 0, reportesAutenticados: 0, reportesAnonimos: 0, esVisiblePublicamente: false },
        create: {
            identificador,
            plataformaId: plataforma!.id,
            totalReportes: 0,
            reportesAutenticados: 0,
            reportesAnonimos: 0,
            esVisiblePublicamente: false,
        },
    });
    return reporte;
}

describe("PATCH /api/admin/reportes/[id]/reactivar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        mockEmbedding.mockReset().mockResolvedValue(new Array(768).fill(0.15));
    });

    it("reactiva un reporte eliminado, regenera embedding y recalcula score", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteDadoDeBaja("RPT-REACT01", "+57300REACT01");
        await prisma.reporte.update({
            where: { id: reporte.id },
            data: { eliminado: true, motivoBaja: "RETIRO_LIMPIEZA", notaBaja: "tmp", eliminadoEn: new Date(), eliminadoPorId: admin.id },
        });

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/reactivar`,
            { nota: "Reactivado por error operativo" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reactivado).toBe(true);
        expect(body.embeddingRegenerado).toBe(true);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.eliminado).toBe(false);
        expect(actualizado?.motivoBaja).toBeNull();

        const embedding = await prisma.embeddingReporte.findUnique({ where: { reporteId: reporte.id } });
        expect(embedding).not.toBeNull();

        const identificador = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: "+57300REACT01", plataformaId: actualizado!.plataformaId } },
        });
        expect(identificador?.totalReportes).toBe(1);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "REPORT_REACTIVATE", recursoId: reporte.id } });
        expect(audit).not.toBeNull();
    });

    it("devuelve 409 si el reporte no está dado de baja", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteDadoDeBaja("RPT-REACT02", "+57300REACT02");

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/reactivar`,
            { nota: "x" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(409);
    });

    it("rechaza si el usuario no es admin", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const reporte = await crearReporteDadoDeBaja("RPT-REACT03", "+57300REACT03");
        await prisma.reporte.update({ where: { id: reporte.id }, data: { eliminado: true } });

        const req = crearRequestAutenticado(
            "PATCH",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/reactivar`,
            { nota: "x" },
            mockToken
        );
        const res = await PATCH(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });
});
