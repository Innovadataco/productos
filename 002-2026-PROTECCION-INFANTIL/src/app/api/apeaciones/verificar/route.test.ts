import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearApelacion } from "@/lib/apealaciones";

const CODIGO_FIJO = "123456";

vi.mock("@/lib/sms", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@/lib/sms")>();
    return {
        ...mod,
        generarCodigoOtp: () => CODIGO_FIJO,
    };
});

function crearRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/apeaciones/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function crearApelacionSms(identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: plataforma!.id } },
        update: { totalReportes: 3, reportesAutenticados: 3, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId: plataforma!.id,
            totalReportes: 3,
            reportesAutenticados: 3,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
    const { token } = await crearApelacion({
        identificador,
        plataformaId: plataforma!.id,
        motivoSolicitud: "Motivo de prueba suficientemente largo para apelar.",
        tipoVerificacion: "SMS",
        contacto: "+573001234567",
    });
    return token;
}

describe("POST /api/apeaciones/verificar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp");
    });

    it("verifica el código OTP correctamente", async () => {
        const token = await crearApelacionSms("+57300VERF01");

        const req = crearRequest({ token, codigo: CODIGO_FIJO });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ verificado: true });

        const apelacion = await prisma.apelacionIdentificador.findFirst({
            where: { identificador: "+57300VERF01" },
        });
        expect(apelacion?.smsVerificado).toBe(true);
    });

    it("rechaza código incorrecto", async () => {
        const token = await crearApelacionSms("+57300VERF02");

        const req = crearRequest({ token, codigo: "000000" });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("rechaza token inválido", async () => {
        const req = crearRequest({ token: "token-invalido", codigo: CODIGO_FIJO });
        const res = await POST(req);
        expect(res.status).toBe(404);
    });
});
