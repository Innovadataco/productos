import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { registrarProbe, evaluarSenal, confirmarRojo, notificarIncidente } from "./incidentes";
import { enviarAlertaInfra } from "@/lib/email";

// El envío de email se mockea (regla arch:check (e): prisma NUNCA se mockea;
// email sí, para no depender de Resend en tests).
vi.mock("@/lib/email", () => ({
    enviarAlertaInfra: vi.fn().mockResolvedValue(undefined),
}));

const enviarAlertaInfraMock = vi.mocked(enviarAlertaInfra);

async function sembrarParamsMonitoreo(overrides: Record<string, string> = {}) {
    const params: Record<string, string> = {
        "monitoreo.enabled": "true",
        "monitoreo.email.throttle_min": "30",
        "monitoreo.email.destinatarios": "ops@example.com, admin@example.com",
        ...overrides,
    };
    for (const [clave, valor] of Object.entries(params)) {
        await prisma.parametroSistema.upsert({
            where: { clave },
            update: { valor },
            create: { clave, valor, tipo: "STRING", categoria: "SYSTEM", esPublico: false },
        });
    }
}

describe("monitoreo/incidentes (SPEC-171)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarParamsMonitoreo();
        enviarAlertaInfraMock.mockClear();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("registrarProbe persiste el HealthProbe con sus campos", async () => {
        await registrarProbe("app", { ok: true, latenciaMs: 42, detalle: "HTTP 200" });
        await registrarProbe("bd", { ok: false, latenciaMs: 7, detalle: "connection refused" });

        const probes = await prisma.healthProbe.findMany({ orderBy: { creadoEn: "asc" } });
        expect(probes).toHaveLength(2);
        expect(probes[0]).toMatchObject({ senal: "app", ok: true, latenciaMs: 42, detalle: "HTTP 200" });
        expect(probes[1]).toMatchObject({ senal: "bd", ok: false, latenciaMs: 7, detalle: "connection refused" });
    });

    it("con monitoreo.enabled=false todo es no-op (sin probes, incidentes ni audit)", async () => {
        await sembrarParamsMonitoreo({ "monitoreo.enabled": "false" });

        await registrarProbe("app", { ok: false, latenciaMs: 1, detalle: "caído" });
        const incidente = await confirmarRojo("app", "caído");

        expect(incidente).toBeNull();
        expect(await prisma.healthProbe.count()).toBe(0);
        expect(await prisma.incidenteInfra.count()).toBe(0);
        expect(await prisma.auditLog.count({ where: { accion: "INFRA_INCIDENTE_ABIERTO" } })).toBe(0);
        expect(enviarAlertaInfraMock).not.toHaveBeenCalled();
    });

    it("evaluarSenal en rojo devuelve pendiente-reprobe SIN abrir incidente", async () => {
        const resultado = await evaluarSenal("ollama_ping", { ok: false, latenciaMs: 5000, detalle: "timeout" });

        expect(resultado).toBe("pendiente-reprobe");
        expect(await prisma.incidenteInfra.count()).toBe(0);
    });

    it("evaluarSenal en verde sin incidente abierto devuelve verde", async () => {
        const resultado = await evaluarSenal("app", { ok: true, latenciaMs: 10 });
        expect(resultado).toBe("verde");
        expect(await prisma.incidenteInfra.count()).toBe(0);
    });

    it("confirmarRojo abre el incidente, audita y envía el email de alerta", async () => {
        const incidente = await confirmarRojo("ollama_smoke", "respuesta vacía del modelo ornith:9b");

        expect(incidente).not.toBeNull();
        expect(incidente!.estado).toBe("ABIERTO");
        expect(incidente!.senal).toBe("ollama_smoke");
        // ultimoEmailEn se marca tras el envío: se relee de BD (el objeto
        // devuelto es el de la creación, anterior a notificarIncidente).
        const persistido = await prisma.incidenteInfra.findUnique({ where: { id: incidente!.id } });
        expect(persistido!.ultimoEmailEn).not.toBeNull();

        const auditApertura = await prisma.auditLog.findFirst({
            where: { accion: "INFRA_INCIDENTE_ABIERTO", recursoId: incidente!.id },
        });
        expect(auditApertura).not.toBeNull();

        expect(enviarAlertaInfraMock).toHaveBeenCalledTimes(1);
        expect(enviarAlertaInfraMock).toHaveBeenCalledWith(
            expect.objectContaining({
                senal: "ollama_smoke",
                detalle: "respuesta vacía del modelo ornith:9b",
                destinatarios: ["ops@example.com", "admin@example.com"],
            })
        );

        const auditEmail = await prisma.auditLog.findFirst({
            where: { accion: "INFRA_EMAIL_ENVIADO", recursoId: incidente!.id },
        });
        expect(auditEmail).not.toBeNull();
    });

    it("confirmarRojo no duplica un incidente ABIERTO ni reenvía el email", async () => {
        const primero = await confirmarRojo("worker", "sin latido hace 200s");
        const segundo = await confirmarRojo("worker", "sin latido hace 260s");

        expect(segundo!.id).toBe(primero!.id);
        expect(await prisma.incidenteInfra.count({ where: { senal: "worker", estado: "ABIERTO" } })).toBe(1);
        expect(enviarAlertaInfraMock).toHaveBeenCalledTimes(1);
    });

    it("evaluarSenal en verde resuelve el incidente abierto y audita el cierre", async () => {
        const incidente = await confirmarRojo("bd", "connection refused");

        const resultado = await evaluarSenal("bd", { ok: true, latenciaMs: 3 });

        expect(resultado).toBe("resuelto");
        const cerrado = await prisma.incidenteInfra.findUnique({ where: { id: incidente!.id } });
        expect(cerrado!.estado).toBe("RESUELTO");
        expect(cerrado!.fin).not.toBeNull();

        const auditCierre = await prisma.auditLog.findFirst({
            where: { accion: "INFRA_INCIDENTE_RESUELTO", recursoId: incidente!.id },
        });
        expect(auditCierre).not.toBeNull();
    });

    it("notificarIncidente respeta el throttle por señal", async () => {
        const incidente = await confirmarRojo("app", "HTTP 500");
        expect(enviarAlertaInfraMock).toHaveBeenCalledTimes(1);

        // Segundo aviso dentro de la ventana de 30 min: no reenvía.
        const fresco = await prisma.incidenteInfra.findUnique({ where: { id: incidente!.id } });
        const enviado = await notificarIncidente(fresco!);

        expect(enviado).toBe(false);
        expect(enviarAlertaInfraMock).toHaveBeenCalledTimes(1);
        expect(await prisma.auditLog.count({ where: { accion: "INFRA_EMAIL_ENVIADO" } })).toBe(1);
    });

    it("notificarIncidente reenvía pasada la ventana de throttle", async () => {
        const incidente = await confirmarRojo("app", "HTTP 500");
        const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
        await prisma.incidenteInfra.update({
            where: { id: incidente!.id },
            data: { ultimoEmailEn: haceUnaHora },
        });

        const enviado = await notificarIncidente({ ...incidente!, ultimoEmailEn: haceUnaHora });

        expect(enviado).toBe(true);
        expect(enviarAlertaInfraMock).toHaveBeenCalledTimes(2);
    });

    it("sin destinatarios configurados abre el incidente pero no envía email", async () => {
        await sembrarParamsMonitoreo({ "monitoreo.email.destinatarios": "" });

        const incidente = await confirmarRojo("tailscale", "timeout");

        expect(incidente).not.toBeNull();
        expect(enviarAlertaInfraMock).not.toHaveBeenCalled();
        expect(incidente!.ultimoEmailEn).toBeNull();
        expect(await prisma.auditLog.count({ where: { accion: "INFRA_EMAIL_ENVIADO" } })).toBe(0);
    });

    it("un fallo del proveedor de email no tumba el ciclo (incidente queda abierto)", async () => {
        enviarAlertaInfraMock.mockRejectedValueOnce(new Error("Resend caído"));

        const incidente = await confirmarRojo("app", "HTTP 503");

        expect(incidente).not.toBeNull();
        expect(incidente!.estado).toBe("ABIERTO");
        // No se marcó ultimoEmailEn ni se auditó el envío: el próximo ciclo reintenta.
        expect(incidente!.ultimoEmailEn).toBeNull();
        expect(await prisma.auditLog.count({ where: { accion: "INFRA_EMAIL_ENVIADO" } })).toBe(0);
    });
});
