import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearUsuario, crearTokenUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { crearApelacion } from "@/lib/apealaciones";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearReporteVisible(identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para reporte sujeto a apelación, con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${identificador.slice(-6).toUpperCase()}`,
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
    const vectorStr = "[" + new Array(768).fill(0.1).join(",") + "]";
    await prisma.$executeRaw`
        INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${reporte.id}, ${vectorStr}::vector, 'nomic-embed-text', NOW())
    `;
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: plataforma!.id } },
        update: { totalReportes: 1, reportesAutenticados: 1, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId: plataforma!.id,
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
    return reporte;
}

async function crearApelacionPendiente(identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const { token } = await crearApelacion({
        identificador,
        plataformaId: plataforma!.id,
        motivoSolicitud: "Motivo de prueba suficientemente largo para resolver.",
        tipoVerificacion: "NICK",
    });
    const apelacion = await prisma.apelacionIdentificador.findFirstOrThrow({
        where: { identificador, plataformaId: plataforma!.id },
    });
    return { apelacion, token };
}

describe("POST /api/admin/apeaciones/[id]/resolver", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp");
        await crearPaisCiudad();
        mockToken = undefined;
    });

    it("acepta apelación y da de baja el reporte seleccionado", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const identificador = "+57300RESOLV01";
        const reporte = await crearReporteVisible(identificador);
        const { apelacion } = await crearApelacionPendiente(identificador);

        const req = new Request(`http://localhost:5005/api/admin/apeaciones/${apelacion.id}/resolver`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({
                accion: "ACEPTAR",
                respuestaAdmin: "Aceptamos la apelación y damos de baja el reporte falso.",
                reportesSeleccionados: [reporte.id],
            }),
        });
        const res = await POST(req, { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });

        const apelacionActualizada = await prisma.apelacionIdentificador.findUnique({ where: { id: apelacion.id } });
        expect(apelacionActualizada?.estado).toBe("ACEPTADA");

        const reporteActualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(reporteActualizado?.eliminado).toBe(true);
        expect(reporteActualizado?.motivoBaja).toBe("REPORTE_FALSO");

        const audit = await prisma.auditLog.findFirst({ where: { accion: "APELACION_RESUELTA", recursoId: apelacion.id } });
        expect(audit).not.toBeNull();
    });

    it("rechaza apelación y bloquea re-apelación", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const identificador = "+57300RESOLV02";
        await crearReporteVisible(identificador);
        const { apelacion } = await crearApelacionPendiente(identificador);

        const req = new Request(`http://localhost:5005/api/admin/apeaciones/${apelacion.id}/resolver`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({
                accion: "RECHAZAR",
                respuestaAdmin: "Rechazamos la apelación por falta de evidencia.",
            }),
        });
        const res = await POST(req, { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(200);

        const apelacionActualizada = await prisma.apelacionIdentificador.findUnique({ where: { id: apelacion.id } });
        expect(apelacionActualizada?.estado).toBe("RECHAZADA");
        expect(apelacionActualizada?.derechoApelar).toBe(false);
    });

    it("rechaza a no admins", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");

        const identificador = "+57300RESOLV03";
        await crearReporteVisible(identificador);
        const { apelacion } = await crearApelacionPendiente(identificador);

        const req = new Request(`http://localhost:5005/api/admin/apeaciones/${apelacion.id}/resolver`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({ accion: "RECHAZAR", respuestaAdmin: "x".repeat(20) }),
        });
        const res = await POST(req, { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(403);
    });
});
