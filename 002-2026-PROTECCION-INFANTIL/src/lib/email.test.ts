import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { enviarAlertaRevision, enviarAlertaScoreCritico } from "./email";
import { crearPlataforma } from "./reporte-test-utils";

const sendMock = vi.fn();

vi.mock("resend", () => ({
    Resend: vi.fn(() => ({
        emails: { send: (...args: unknown[]) => sendMock(...args) },
    })),
}));

async function crearAdmin(email: string) {
    const { hashPassword } = await import("./auth");
    return prisma.usuario.create({
        data: {
            email,
            nombre: "Admin",
            passwordHash: await hashPassword("Admin123!"),
            rol: "ADMIN",
            estado: "activo",
        },
    });
}

describe("enviarAlertaRevision", () => {
    beforeEach(async () => {
        await resetDatabase();
        sendMock.mockReset().mockResolvedValue({ id: "email-id" });
    });

    it("no envía email si no hay administradores activos", async () => {
        await enviarAlertaRevision({
            id: "reporte-1",
            numeroSeguimiento: "RPT-001",
            identificador: "+573001234567",
            estado: "REVISION_MANUAL",
        });
        expect(sendMock).not.toHaveBeenCalled();
    });

    it("envía alerta a administradores sin incluir texto original ni PII", async () => {
        await crearAdmin("admin@example.com");
        await enviarAlertaRevision({
            id: "reporte-1",
            numeroSeguimiento: "RPT-001",
            identificador: "+573001234567",
            estado: "REVISION_MANUAL",
        });

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.to).toEqual(["admin@example.com"]);
        expect(args.subject).toContain("RPT-001");
        expect(args.text).toContain("+573001234567");
        expect(args.text).toContain("REVISION_MANUAL");
        expect(args.text).not.toContain("María");
        expect(args.text).not.toContain("texto original");
    });

    it("no envía alerta cuando alerts.admin.enabled es false", async () => {
        await prisma.parametroSistema.create({
            data: {
                clave: "alerts.admin.enabled",
                valor: "false",
                tipo: "BOOLEAN",
                categoria: "EMAIL",
                esPublico: false,
                descripcion: "",
            },
        });
        await crearAdmin("admin@example.com");

        await enviarAlertaRevision({
            id: "reporte-1",
            numeroSeguimiento: "RPT-001",
            identificador: "+573001234567",
            estado: "REVISION_MANUAL",
        });

        expect(sendMock).not.toHaveBeenCalled();
    });
});

describe("enviarAlertaScoreCritico", () => {
    beforeEach(async () => {
        await resetDatabase();
        sendMock.mockReset().mockResolvedValue({ id: "email-id" });
    });

    it("envía alerta con identificador, plataforma y nivel de riesgo", async () => {
        const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
        await crearAdmin("admin@example.com");

        await enviarAlertaScoreCritico({
            id: "reporte-1",
            identificador: "+57300999999",
            plataformaId: plataforma.id,
            score: 95,
            nivelRiesgo: "CRITICO",
        });

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.to).toEqual(["admin@example.com"]);
        expect(args.subject).toContain("+57300999999");
        expect(args.text).toContain("95");
        expect(args.text).toContain("CRITICO");
        expect(args.text).toContain("WhatsApp");
    });

    it("no envía alerta cuando alerts.critical_score.enabled es false", async () => {
        await prisma.parametroSistema.create({
            data: {
                clave: "alerts.critical_score.enabled",
                valor: "false",
                tipo: "BOOLEAN",
                categoria: "EMAIL",
                esPublico: false,
                descripcion: "",
            },
        });
        const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
        await crearAdmin("admin@example.com");

        await enviarAlertaScoreCritico({
            id: "reporte-1",
            identificador: "+57300999999",
            plataformaId: plataforma.id,
            score: 95,
            nivelRiesgo: "CRITICO",
        });

        expect(sendMock).not.toHaveBeenCalled();
    });
});
