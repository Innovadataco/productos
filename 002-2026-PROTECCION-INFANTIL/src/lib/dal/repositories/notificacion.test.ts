/**
 * SPEC-201: tests de NotificacionRepository (cola + auditoría).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { NotificacionRepository } from "./notificacion";

async function crearNotificacion(data: {
    evento?: string;
    destinatarioEmail?: string;
    plantillaClave?: string;
    canal?: "EMAIL" | "IN_APP";
    estado?: "ENCOLADA" | "REINTENTANDO" | "ENVIADA";
    enviarEn?: Date;
    proveedorId?: string | null;
}) {
    return prisma.notificacion.create({
        data: {
            evento: data.evento ?? "test.evento",
            destinatarioEmail: data.destinatarioEmail ?? "test@example.com",
            plantillaClave: data.plantillaClave ?? "test.plantilla.email",
            canal: data.canal ?? "EMAIL",
            estado: data.estado ?? "ENCOLADA",
            enviarEn: data.enviarEn ?? new Date(),
            variables: {},
            ...(data.proveedorId !== undefined ? { proveedorId: data.proveedorId } : {}),
        },
    });
}

describe("NotificacionRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea una notificación en estado ENCOLADA", async () => {
        const repo = new NotificacionRepository();
        const creada = await repo.crear({
            evento: "test.evento",
            destinatarioEmail: "a@example.com",
            plantillaClave: "test.plantilla.email",
            canal: "EMAIL",
            variables: { nombre: "A" },
        });
        expect(creada.estado).toBe("ENCOLADA");
        expect(creada.destinatarioEmail).toBe("a@example.com");
    });

    it("listarPendientesParaEnvio respeta enviarEn y estado", async () => {
        const repo = new NotificacionRepository();
        const ahora = new Date();
        await crearNotificacion({ enviarEn: new Date(ahora.getTime() - 1000), estado: "ENCOLADA" });
        await crearNotificacion({ enviarEn: new Date(ahora.getTime() + 60_000), estado: "ENCOLADA" });
        await crearNotificacion({ enviarEn: new Date(ahora.getTime() - 1000), estado: "ENVIADA" });

        const pendientes = await repo.listarPendientesParaEnvio(ahora, 10);
        expect(pendientes).toHaveLength(1);
        expect(pendientes[0].estado).toBe("ENCOLADA");
    });

    it("listarPendientesParaEnvio incluye REINTENTANDO", async () => {
        const repo = new NotificacionRepository();
        const ahora = new Date();
        await crearNotificacion({ enviarEn: new Date(ahora.getTime() - 1000), estado: "REINTENTANDO" });

        const pendientes = await repo.listarPendientesParaEnvio(ahora, 10);
        expect(pendientes).toHaveLength(1);
    });

    it("marcarEnviando actualiza el estado", async () => {
        const repo = new NotificacionRepository();
        const notif = await crearNotificacion({});
        const actualizada = await repo.marcarEnviando(notif.id);
        expect(actualizada.estado).toBe("ENVIANDO");
    });

    it("marcarEnviada registra proveedorId", async () => {
        const repo = new NotificacionRepository();
        const notif = await crearNotificacion({});
        const actualizada = await repo.marcarEnviada(notif.id, "resend-123");
        expect(actualizada.estado).toBe("ENVIADA");
        expect(actualizada.proveedorId).toBe("resend-123");
        expect(actualizada.sentAt).not.toBeNull();
    });

    it("marcarAbierta y marcarClicada actualizan timestamps", async () => {
        const repo = new NotificacionRepository();
        const notif = await crearNotificacion({ estado: "ENVIADA" });
        await repo.marcarAbierta(notif.id);
        const abierta = await repo.findById(notif.id);
        expect(abierta?.estado).toBe("ABIERTA");
        expect(abierta?.openedAt).not.toBeNull();

        await repo.marcarClicada(notif.id);
        const clicada = await repo.findById(notif.id);
        expect(clicada?.estado).toBe("CLICADA");
        expect(clicada?.clickedAt).not.toBeNull();
    });

    it("cancelar solo afecta programaciones futuras por defecto", async () => {
        const repo = new NotificacionRepository();
        const futura = await crearNotificacion({
            enviarEn: new Date(Date.now() + 60_000),
            estado: "ENCOLADA",
        });
        const pasada = await crearNotificacion({
            enviarEn: new Date(Date.now() - 60_000),
            estado: "ENCOLADA",
        });

        const resultado = await repo.cancelar({ evento: "test.evento", motivo: "test" });
        expect(resultado.count).toBe(1);

        const futuraActual = await repo.findById(futura.id);
        const pasadaActual = await repo.findById(pasada.id);
        expect(futuraActual?.estado).toBe("CANCELADA");
        expect(pasadaActual?.estado).toBe("ENCOLADA");
    });

    it("existeProveedorId detecta duplicado", async () => {
        const repo = new NotificacionRepository();
        await crearNotificacion({ proveedorId: "resend-abc" });
        expect(await repo.existeProveedorId("resend-abc")).toBe(true);
        expect(await repo.existeProveedorId("resend-xyz")).toBe(false);
    });

    it("findByProveedorId recupera notificación", async () => {
        const repo = new NotificacionRepository();
        await crearNotificacion({ proveedorId: "resend-abc" });
        const encontrada = await repo.findByProveedorId("resend-abc");
        expect(encontrada).not.toBeNull();
    });

    it("contarPorEstado agrupa correctamente", async () => {
        const repo = new NotificacionRepository();
        await crearNotificacion({ estado: "ENCOLADA" });
        await crearNotificacion({ estado: "ENCOLADA" });
        await crearNotificacion({ estado: "ENVIADA" });

        const conteos = await repo.contarPorEstado();
        const map = new Map(conteos.map((c) => [c.estado, c._count.estado]));
        expect(map.get("ENCOLADA")).toBe(2);
        expect(map.get("ENVIADA")).toBe(1);
    });
});
