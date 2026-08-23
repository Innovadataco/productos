import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { SessionLogService } from "./session-log";

describe("SessionLogService (SPEC-206)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("registrarInicioSesion crea sesión abierta", async () => {
        const padre = await crearUsuario("PARENT", "padre-service@example.com");
        const req = new Request("http://localhost:5005/api/auth/login", {
            headers: { "user-agent": "Vitest/1.0" },
        });

        const service = new SessionLogService();
        const id = await service.registrarInicioSesion(req, { id: padre.id, rol: padre.rol });

        const sesion = await prisma.sesionLog.findUnique({ where: { id } });
        expect(sesion).not.toBeNull();
        expect(sesion!.usuarioId).toBe(padre.id);
        expect(sesion!.cerradaEn).toBeNull();
        expect(sesion!.ipHash).toMatch(/^[a-f0-9]{64}$/);
        expect(sesion!.userAgent).toBe("Vitest/1.0");
    });

    it("pingSesion actualiza solo sesiones abiertas del usuario", async () => {
        const padre = await crearUsuario("PARENT", "padre-ping-service@example.com");
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(Date.now() - 120_000),
                ultimaActividadEn: new Date(Date.now() - 120_000),
                ipHash: "hash",
            },
        });

        const service = new SessionLogService();
        const actualizado = await service.pingSesion(sesion.id, padre.id);
        expect(actualizado).toBe(true);

        const otra = await crearUsuario("PARENT", "otro-ping-service@example.com");
        const actualizadoOtro = await service.pingSesion(sesion.id, otra.id);
        expect(actualizadoOtro).toBe(false);
    });

    it("cerrarPorInactividad cierra solo las inactivas y registra audit", async () => {
        const padre = await crearUsuario("PARENT", "padre-inactivo@example.com");
        const activa = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "hash",
            },
        });
        const inactiva = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(Date.now() - 120_000),
                ultimaActividadEn: new Date(Date.now() - 120_000),
                ipHash: "hash",
            },
        });

        const service = new SessionLogService();
        const cerradas = await service.cerrarPorInactividad(1);
        expect(cerradas).toBe(1);

        const a = await prisma.sesionLog.findUnique({ where: { id: activa.id } });
        const i = await prisma.sesionLog.findUnique({ where: { id: inactiva.id } });
        expect(a!.cerradaEn).toBeNull();
        expect(i!.cerradaEn).not.toBeNull();
        expect(i!.motivoCierre).toBe("INACTIVIDAD");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "SESION_CIERRE_INACTIVIDAD" },
        });
        expect(audit).not.toBeNull();
    });

    it("cerrarForzado rechaza sesión ya cerrada", async () => {
        const admin = await crearUsuario("ADMIN", "admin-forzado@example.com");
        const padre = await crearUsuario("PARENT", "padre-forzado@example.com");
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                cerradaEn: new Date(),
                motivoCierre: "INACTIVIDAD",
                ipHash: "hash",
            },
        });

        const service = new SessionLogService();
        await expect(service.cerrarForzado(sesion.id, admin.id)).rejects.toThrow("ya cerrada");
    });

    it("estaSesionActiva distingue abierta de cerrada", async () => {
        const padre = await crearUsuario("PARENT", "padre-activa@example.com");
        const abierta = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "hash",
            },
        });
        const cerrada = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                cerradaEn: new Date(),
                motivoCierre: "FORZADA",
                ipHash: "hash",
            },
        });

        const service = new SessionLogService();
        expect(await service.estaSesionActiva(abierta.id)).toBe(true);
        expect(await service.estaSesionActiva(cerrada.id)).toBe(false);
        expect(await service.estaSesionActiva("inexistente")).toBe(false);
    });

    it("purgarAntiguas borra solo sesiones anteriores al umbral", async () => {
        const padre = await crearUsuario("PARENT", "padre-purgar@example.com");
        const vieja = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                ultimaActividadEn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                cerradaEn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                motivoCierre: "INACTIVIDAD",
                ipHash: "hash",
                creadoEn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            },
        });
        const reciente = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "hash",
            },
        });

        const service = new SessionLogService();
        const purgadas = await service.purgarAntiguas(2);
        expect(purgadas).toBe(1);

        const existeVieja = await prisma.sesionLog.findUnique({ where: { id: vieja.id } });
        const existeReciente = await prisma.sesionLog.findUnique({ where: { id: reciente.id } });
        expect(existeVieja).toBeNull();
        expect(existeReciente).not.toBeNull();
    });
});
