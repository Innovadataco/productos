/**
 * SPEC-169 (Fase G): tests de NotificacionInAppRepository — CRUD, A/B,
 * conteo de no leídas y archivado.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { NotificacionInAppRepository } from "./notificacion-in-app";

async function crearNotificacion(
    colegioId: string,
    usuarioId: string,
    tipo: "ALERTA_NUEVA" | "ALERTA_GESTIONADA" | "ALERTA_ESCALADA" | "SISTEMA" = "ALERTA_NUEVA",
    entidadId?: string
) {
    return prisma.notificacionInApp.create({
        data: {
            colegioId,
            usuarioId,
            tipo,
            titulo: "Título",
            mensaje: "Mensaje",
            ...(entidadId ? { entidadId } : {}),
        },
    });
}

describe("NotificacionInAppRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listar devuelve solo notificaciones no archivadas del colegio", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        const { colegio: otroColegio, admin: otroAdmin } = await crearColegioConAdmin();
        const propia = await crearNotificacion(colegio.id, admin.id);
        await crearNotificacion(otroColegio.id, otroAdmin.id);
        await prisma.notificacionInApp.update({ where: { id: propia.id }, data: { archivadaEn: new Date() } });

        const repo = new NotificacionInAppRepository();
        const resultado = await repo.listar(colegio.id, admin.id, { page: 1, pageSize: 25 });
        expect(resultado.items).toHaveLength(0);
        expect(resultado.total).toBe(0);
    });

    it("contarNoLeidas excluye leídas y archivadas", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        await crearNotificacion(colegio.id, admin.id);
        const leida = await crearNotificacion(colegio.id, admin.id);
        await prisma.notificacionInApp.update({ where: { id: leida.id }, data: { leidaEn: new Date() } });

        const repo = new NotificacionInAppRepository();
        expect(await repo.contarNoLeidas(colegio.id, admin.id)).toBe(1);
    });

    it("marcarLeida registra leidaEn", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        const notificacion = await crearNotificacion(colegio.id, admin.id);
        const repo = new NotificacionInAppRepository();

        const afectadas = await repo.marcarLeida(colegio.id, admin.id, notificacion.id);
        expect(afectadas).toBe(1);

        const actualizada = await prisma.notificacionInApp.findUnique({ where: { id: notificacion.id } });
        expect(actualizada?.leidaEn).not.toBeNull();
    });

    it("marcarTodasLeidas afecta solo las no leídas del usuario", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        await crearNotificacion(colegio.id, admin.id);
        await crearNotificacion(colegio.id, admin.id);

        const { colegio: otroColegio, admin: otroAdmin } = await crearColegioConAdmin();
        await crearNotificacion(otroColegio.id, otroAdmin.id);

        const repo = new NotificacionInAppRepository();
        const afectadas = await repo.marcarTodasLeidas(colegio.id, admin.id);
        expect(afectadas).toBe(2);
        expect(await repo.contarNoLeidas(colegio.id, admin.id)).toBe(0);
        expect(await repo.contarNoLeidas(otroColegio.id, otroAdmin.id)).toBe(1);
    });

    it("archivar marca archivadaEn y la excluye del listado", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        const notificacion = await crearNotificacion(colegio.id, admin.id);
        const repo = new NotificacionInAppRepository();

        const afectadas = await repo.archivar(colegio.id, admin.id, notificacion.id);
        expect(afectadas).toBe(1);

        const listado = await repo.listar(colegio.id, admin.id, { page: 1, pageSize: 25 });
        expect(listado.items).toHaveLength(0);
    });

    it("crear persiste una notificación", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        const repo = new NotificacionInAppRepository();
        const creada = await repo.crear({
            colegioId: colegio.id,
            usuarioId: admin.id,
            tipo: "ALERTA_NUEVA",
            titulo: "Nueva alerta",
            mensaje: "Alerta",
            entidadId: "alerta-123",
        });
        expect(creada.tipo).toBe("ALERTA_NUEVA");
        expect(creada.colegioId).toBe(colegio.id);
        expect(creada.entidadId).toBe("alerta-123");
    });
});
