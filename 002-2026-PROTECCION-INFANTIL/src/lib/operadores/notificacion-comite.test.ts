import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { notificarComiteSiCorresponde } from "./notificacion-comite";
import { encryptParameter } from "@/lib/param-encryption";

const sendMock = vi.fn();
let parametroEnabled = "true";
let parametroFrecuencia = "24";
let ultimoEnvio: Date | null = null;

vi.mock("resend", () => ({
    Resend: vi.fn(() => ({
        emails: { send: (...args: unknown[]) => sendMock(...args) },
    })),
}));

vi.mock("@/lib/parametros", () => ({
    getParametroSistemaValor: vi.fn((clave: string) => {
        if (clave === "comite.notificaciones.enabled") return Promise.resolve(parametroEnabled);
        if (clave === "comite.notificaciones.frecuencia_horas") return Promise.resolve(parametroFrecuencia);
        return Promise.resolve(null);
    }),
}));

async function crearComiteActivo() {
    const admin = await crearUsuario("ADMIN");
    const comite = await crearUsuario("COMITE_VALIDACION", "comite@example.com");
    await prisma.perfilOperador.create({
        data: {
            usuarioId: comite.id,
            creadoPorId: admin.id,
            esComite: true,
            ultimoEmailNotificacionEn: ultimoEnvio,
        },
    });
    return comite;
}

async function crearReporteOperador(plataformaId: string, operadorId: string) {
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId,
            texto: "texto",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            numeroSeguimiento: `RPT-${Date.now()}`,
            operadorId,
        },
    });
}

describe("notificarComiteSiCorresponde", () => {
    beforeEach(async () => {
        await resetDatabase();
        sendMock.mockReset().mockResolvedValue({ id: "email-id" });
        parametroEnabled = "true";
        parametroFrecuencia = "24";
        ultimoEnvio = null;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("no envía si las notificaciones están deshabilitadas", async () => {
        parametroEnabled = "false";
        await crearComiteActivo();

        await notificarComiteSiCorresponde();
        expect(sendMock).not.toHaveBeenCalled();
    });

    it("no envía si no hay casos pendientes", async () => {
        await crearComiteActivo();

        await notificarComiteSiCorresponde();
        expect(sendMock).not.toHaveBeenCalled();
    });

    it("envía email cuando hay casos pendientes y actualiza timestamp", async () => {
        const comite = await crearComiteActivo();
        const plataforma = await prisma.plataforma.upsert({
            where: { clave: "whatsapp" },
            update: {},
            create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
        });
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        const reporte = await crearReporteOperador(plataforma.id, operador.id);
        await prisma.solicitudComite.create({
            data: {
                reporteId: reporte.id,
                numero: "SOL-TEST01",
                estado: "PENDIENTE",
                operadorId: operador.id,
                motivo: "Test",
            },
        });

        await notificarComiteSiCorresponde();

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.to).toBe("comite@example.com");
        expect(args.subject).toContain("1 casos pendientes");
        expect(args.text).toContain("/dashboard/admin/comite");

        const perfil = await prisma.perfilOperador.findUnique({ where: { usuarioId: comite.id } });
        expect(perfil?.ultimoEmailNotificacionEn).not.toBeNull();
    });

    it("respeta la frecuencia mínima entre envíos", async () => {
        const comite = await crearComiteActivo();
        const plataforma = await prisma.plataforma.upsert({
            where: { clave: "whatsapp" },
            update: {},
            create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
        });
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        const reporte = await crearReporteOperador(plataforma.id, operador.id);
        await prisma.solicitudComite.create({
            data: {
                reporteId: reporte.id,
                numero: "SOL-TEST02",
                estado: "PENDIENTE",
                operadorId: operador.id,
                motivo: "Test",
            },
        });

        await prisma.perfilOperador.update({
            where: { usuarioId: comite.id },
            data: { ultimoEmailNotificacionEn: new Date() },
        });

        await notificarComiteSiCorresponde();
        expect(sendMock).not.toHaveBeenCalled();
    });

    it("envía si pasó el cooldown configurado", async () => {
        const comite = await crearComiteActivo();
        const plataforma = await prisma.plataforma.upsert({
            where: { clave: "whatsapp" },
            update: {},
            create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
        });
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        const reporte = await crearReporteOperador(plataforma.id, operador.id);
        await prisma.solicitudComite.create({
            data: {
                reporteId: reporte.id,
                numero: "SOL-TEST03",
                estado: "PENDIENTE",
                operadorId: operador.id,
                motivo: "Test",
            },
        });

        await prisma.perfilOperador.update({
            where: { usuarioId: comite.id },
            data: { ultimoEmailNotificacionEn: new Date(Date.now() - 25 * 60 * 60 * 1000) },
        });

        await notificarComiteSiCorresponde();
        expect(sendMock).toHaveBeenCalledOnce();
    });
});
