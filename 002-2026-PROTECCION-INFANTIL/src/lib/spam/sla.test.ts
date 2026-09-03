/**
 * I-280 (SPEC-387) — el job de SLA de spam avisa UNA VEZ por reporte hasta
 * que el reporte cambie. Antes de este candado, `enviarAlertaRevision` se
 * llamaba en cada vuelta (cada 15 min) para todos los `POSIBLE_SPAM` vencidos:
 * 1.894 correos sobre 135 casos en 24 h.
 *
 * Regla nueva: se compara `AuditLog.SPAM_ALERTA_REVISION_ENVIADA.creadoEn`
 * contra `Reporte.actualizadoEn`. Si el aviso es tan reciente o más que la
 * última modificación, se salta. Cuando el reporte cambia (`actualizadoEn`
 * se mueve), la próxima vez que vence sí se avisa de nuevo.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma } from "@/lib/reporte-test-utils";
import { revisarSlaSpam } from "./sla";

const mockEnviarAlertaRevision = vi.fn<(arg: { id: string; numeroSeguimiento: string | null; identificador: string; estado: string; prioridadAlta?: boolean }) => Promise<void>>(async () => undefined);
vi.mock("@/lib/email", () => ({
    enviarAlertaRevision: (arg: { id: string; numeroSeguimiento: string | null; identificador: string; estado: string; prioridadAlta?: boolean }) => mockEnviarAlertaRevision(arg),
}));

async function crearReporteSpamVencido(overrides: { creadoEn?: Date } = {}) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const hace3dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return prisma.reporte.create({
        data: {
            identificador: `+57300SPAM${Math.floor(Math.random() * 1000000)}`,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba del reporte spam",
            fechaIncidente: hace3dias,
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            estado: "POSIBLE_SPAM",
            numeroSeguimiento: `RPT-SPAM${Date.now()}${Math.floor(Math.random() * 1000)}`,
            creadoEn: overrides.creadoEn ?? hace3dias,
        },
    });
}

async function setSlaHoras(valor = "48") {
    await prisma.parametroSistema.upsert({
        where: { clave: "spam.sla_horas" },
        update: { valor },
        create: {
            clave: "spam.sla_horas",
            valor,
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
}

describe("revisarSlaSpam · candado de repetición (I-280 · SPEC-387)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await setSlaHoras("48");
        mockEnviarAlertaRevision.mockClear();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("dos corridas seguidas del job → UN solo correo + UNA fila SPAM_ALERTA_REVISION_ENVIADA", async () => {
        const reporte = await crearReporteSpamVencido();

        await revisarSlaSpam();
        await revisarSlaSpam();

        expect(mockEnviarAlertaRevision).toHaveBeenCalledTimes(1);
        const primerLlamada = mockEnviarAlertaRevision.mock.calls[0];
        expect(primerLlamada?.[0]).toMatchObject({ id: reporte.id, estado: "POSIBLE_SPAM" });
        const audits = await prisma.auditLog.findMany({
            where: { accion: "SPAM_ALERTA_REVISION_ENVIADA", recursoId: reporte.id },
        });
        expect(audits).toHaveLength(1);
    });

    it("si el reporte cambia (actualizadoEn > último aviso), la SIGUIENTE corrida vuelve a avisar", async () => {
        const reporte = await crearReporteSpamVencido();

        await revisarSlaSpam();
        expect(mockEnviarAlertaRevision).toHaveBeenCalledTimes(1);

        // Simular un cambio del reporte (bump de actualizadoEn hacia el futuro).
        const enUnMinuto = new Date(Date.now() + 60 * 1000);
        await prisma.reporte.update({
            where: { id: reporte.id },
            data: { actualizadoEn: enUnMinuto },
        });

        await revisarSlaSpam();
        expect(mockEnviarAlertaRevision, "el cambio del reporte reabre la ventana de aviso").toHaveBeenCalledTimes(2);
    });

    it("si el correo TRUENA, no se registra audit — la siguiente vuelta reintenta", async () => {
        const reporte = await crearReporteSpamVencido();
        mockEnviarAlertaRevision.mockRejectedValueOnce(new Error("SMTP caído"));

        await revisarSlaSpam();
        expect(mockEnviarAlertaRevision).toHaveBeenCalledTimes(1);
        const auditsTrasError = await prisma.auditLog.findMany({
            where: { accion: "SPAM_ALERTA_REVISION_ENVIADA", recursoId: reporte.id },
        });
        expect(auditsTrasError, "un correo fallido no debe quedar como enviado").toHaveLength(0);

        // Segunda vuelta con SMTP arriba: se manda y ahora sí se registra.
        await revisarSlaSpam();
        expect(mockEnviarAlertaRevision).toHaveBeenCalledTimes(2);
        const auditsTrasReintento = await prisma.auditLog.findMany({
            where: { accion: "SPAM_ALERTA_REVISION_ENVIADA", recursoId: reporte.id },
        });
        expect(auditsTrasReintento).toHaveLength(1);
    });
});
