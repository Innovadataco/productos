/**
 * SPEC-203 (002-PI-100): tests de marcar una notificación como leída.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("PATCH /api/notificaciones/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("marca como leída una notificación in-app del usuario", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        await prisma.notificacionPlantilla.create({
            data: { clave: "reporte.resuelto.in_app", canal: "IN_APP", cuerpoMarkdown: "Hola" },
        });
        const notificacion = await prisma.notificacion.create({
            data: {
                evento: "reporte.resuelto",
                destinatarioUsuarioId: user.id,
                destinatarioEmail: "test@example.com",
                plantillaClave: "reporte.resuelto.in_app",
                canal: "IN_APP",
                variables: {},
                estado: "ENVIADA",
            },
        });

        const res = await PATCH(
            crearRequestAutenticado("PATCH", `http://localhost:5005/api/notificaciones/${notificacion.id}`, {}, mockToken),
            { params: Promise.resolve({ id: notificacion.id }) }
        );
        expect(res.status).toBe(200);
        const actualizada = await prisma.notificacion.findUnique({ where: { id: notificacion.id } });
        expect(actualizada?.estado).toBe("ABIERTA");
        expect(actualizada?.openedAt).not.toBeNull();
    });

    it("devuelve 404 si la notificación no pertenece al usuario", async () => {
        const [userA, userB] = await Promise.all([crearUsuario("PARENT"), crearUsuario("PARENT")]);
        mockToken = await crearTokenUsuario(userA.id, "PARENT");
        await prisma.notificacionPlantilla.create({
            data: { clave: "reporte.resuelto.in_app", canal: "IN_APP", cuerpoMarkdown: "Hola" },
        });
        const notificacion = await prisma.notificacion.create({
            data: {
                evento: "reporte.resuelto",
                destinatarioUsuarioId: userB.id,
                destinatarioEmail: "test@example.com",
                plantillaClave: "reporte.resuelto.in_app",
                canal: "IN_APP",
                variables: {},
                estado: "ENVIADA",
            },
        });

        const res = await PATCH(
            crearRequestAutenticado("PATCH", `http://localhost:5005/api/notificaciones/${notificacion.id}`, {}, mockToken),
            { params: Promise.resolve({ id: notificacion.id }) }
        );
        expect(res.status).toBe(404);
    });
});
