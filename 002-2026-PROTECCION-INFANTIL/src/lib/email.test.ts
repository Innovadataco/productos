import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import {
    enviarAlertaRevision,
    enviarAlertaScoreCritico,
    enviarAvisoReporteNuevoColegio,
    enviarAvisoUmbralCursoColegio,
    enviarAvisoEstudianteRepetidoColegio,
    enviarResumenSemanalColegio,
} from "./email";
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

/**
 * SPEC-149 (FR-006/FR-009) — Avisos del colegio: copy ciego humano en español
 * (terminología §3: "aviso"/"te avisamos"), cero PII/scores/identificadores
 * (I-28/I-29). Resend MOCKEADO: cero llamadas reales.
 */
describe("avisos del colegio (SPEC-149)", () => {
    beforeEach(() => {
        sendMock.mockReset().mockResolvedValue({ id: "email-id" });
    });

    const PII_PROHIBIDA = ["+5730", "María", "score", "SCORE", "identificador", "texto del reporte", "notificación", "notificacion"];

    it("aviso de reporte nuevo: 'te avisamos' + link a alertas, cero PII", async () => {
        await enviarAvisoReporteNuevoColegio("rector@colegio.edu.co");

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.to).toBe("rector@colegio.edu.co");
        expect(args.subject).toContain("Te avisamos");
        expect(args.text).toContain("reporte nuevo");
        expect(args.text).toContain("/dashboard/colegio/alertas");
        for (const termino of PII_PROHIBIDA) {
            expect(`${args.subject}\n${args.text}`).not.toContain(termino);
        }
    });

    it("aviso de umbral por curso: conteos agregados, sin nombre de curso ni PII", async () => {
        await enviarAvisoUmbralCursoColegio("rector@colegio.edu.co", { reportes: 3, dias: 7 });

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.subject).toContain("Te avisamos");
        expect(args.text).toContain("3 reportes");
        expect(args.text).toContain("7 días");
        for (const termino of PII_PROHIBIDA) {
            expect(`${args.subject}\n${args.text}`).not.toContain(termino);
        }
    });

    it("aviso de estudiante repetido: nunca incluye el nombre del estudiante", async () => {
        await enviarAvisoEstudianteRepetidoColegio("rector@colegio.edu.co", { reportes: 2, dias: 30 });

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.subject).toContain("Te avisamos");
        expect(args.text).toContain("un estudiante de tu colegio");
        expect(args.text).toContain("no incluye el nombre del estudiante");
        for (const termino of PII_PROHIBIDA) {
            expect(`${args.subject}\n${args.text}`).not.toContain(termino);
        }
    });

    it("resumen semanal con actividad: reportes de la semana, 'te espera' y avisos guardados", async () => {
        await enviarResumenSemanalColegio("rector@colegio.edu.co", { reportesSemana: 2, teEsperan: 1, pendientesDigest: 3 });

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.subject).toContain("resumen de la semana");
        expect(args.text).toContain("2 reportes nuevos");
        expect(args.text).toContain("1 reporte que te espera");
        expect(args.text).toContain("3 avisos quedaron guardados");
        expect(args.text).not.toContain("Semana tranquila");
        for (const termino of PII_PROHIBIDA) {
            expect(`${args.subject}\n${args.text}`).not.toContain(termino);
        }
    });

    it("resumen de semana tranquila: copy positivo (la calma se muestra como trabajo)", async () => {
        await enviarResumenSemanalColegio("rector@colegio.edu.co", { reportesSemana: 0, teEsperan: 0, pendientesDigest: 0 });

        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.text).toContain("Semana tranquila");
        expect(args.text).toContain("la vigilancia siguió activa");
    });

    it("error del proveedor propaga excepción (el handler marca FALLIDO y pg-boss reintenta)", async () => {
        sendMock.mockResolvedValue({ error: { message: "provider down" } });

        await expect(enviarAvisoReporteNuevoColegio("rector@colegio.edu.co")).rejects.toThrow();
    });
});
