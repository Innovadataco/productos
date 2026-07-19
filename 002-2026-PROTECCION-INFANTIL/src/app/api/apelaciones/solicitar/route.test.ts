import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma } from "@/lib/reporte-test-utils";

function crearRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/apelaciones/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function crearIdentificadorVisible(identificador: string, plataformaId: string) {
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId } },
        update: { totalReportes: 3, reportesAutenticados: 3, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId,
            totalReportes: 3,
            reportesAutenticados: 3,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
}

describe("POST /api/apelaciones/solicitar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp");
    });

    it("crea una apelación con verificación NICK y pausa visibilidad", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearIdentificadorVisible("+57300APEL01", plataforma!.id);

        const req = crearRequest({
            identificador: "+57300APEL01",
            plataformaClave: "whatsapp",
            motivoSolicitud: "Quiero apelar porque este reporte es falso y no corresponde.",
            tipoVerificacion: "NICK",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.token).toBeDefined();
        expect(body.requiereVerificacion).toBe(false);

        const apelacion = await prisma.apelacionIdentificador.findFirst({
            where: { identificador: "+57300APEL01", plataformaId: plataforma!.id },
        });
        expect(apelacion).not.toBeNull();
        expect(apelacion?.estado).toBe("RECIBIDA");
        expect(apelacion?.pausaHasta).not.toBeNull();

        const identificador = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: "+57300APEL01", plataformaId: plataforma!.id } },
        });
        expect(identificador?.esVisiblePublicamente).toBe(false);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "APELACION_CREADA" } });
        expect(audit).not.toBeNull();
    });

    it("crea una apelación con verificación SMS y requiere OTP", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearIdentificadorVisible("+57300APEL02", plataforma!.id);

        const req = crearRequest({
            identificador: "+57300APEL02",
            plataformaClave: "whatsapp",
            motivoSolicitud: "Quiero apelar porque este reporte es falso y no corresponde.",
            tipoVerificacion: "SMS",
            contacto: "+573001234567",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        expect(body.requiereVerificacion).toBe(true);

        const apelacion = await prisma.apelacionIdentificador.findFirst({
            where: { identificador: "+57300APEL02", plataformaId: plataforma!.id },
        });
        expect(apelacion?.tipoVerificacion).toBe("SMS");
        expect(apelacion?.smsCodigoHash).not.toBeNull();
    });

    it("rechaza si falta contacto en verificación SMS", async () => {
        const req = crearRequest({
            identificador: "+57300APEL03",
            plataformaClave: "whatsapp",
            motivoSolicitud: "Quiero apelar porque este reporte es falso y no corresponde.",
            tipoVerificacion: "SMS",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("rechaza plataforma inválida", async () => {
        const req = crearRequest({
            identificador: "+57300APEL04",
            plataformaClave: "noexiste",
            motivoSolicitud: "Quiero apelar porque este reporte es falso y no corresponde.",
            tipoVerificacion: "NICK",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("rechaza apelación activa duplicada", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearIdentificadorVisible("+57300APEL05", plataforma!.id);

        const req1 = crearRequest({
            identificador: "+57300APEL05",
            plataformaClave: "whatsapp",
            motivoSolicitud: "Primera apelación con texto suficientemente largo para ser válido.",
            tipoVerificacion: "NICK",
        });
        const res1 = await POST(req1);
        expect(res1.status).toBe(201);

        const req2 = crearRequest({
            identificador: "+57300APEL05",
            plataformaClave: "whatsapp",
            motivoSolicitud: "Segunda apelación con texto suficientemente largo para ser válido.",
            tipoVerificacion: "NICK",
        });
        const res2 = await POST(req2);
        expect(res2.status).toBe(409);
    });
});
