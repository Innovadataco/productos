import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

function cerrarSesion(id: string, token?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return POST(
        new Request(`http://localhost:5005/api/admin/sesiones/${id}/cerrar`, {
            method: "POST",
            headers,
        }),
        { params: Promise.resolve({ id }) }
    );
}

describe("POST /api/admin/sesiones/[id]/cerrar (SPEC-206)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("admin cierra sesión de otro usuario y queda registrada", async () => {
        const admin = await crearUsuario("ADMIN", "admin-cerrar@example.com");
        const adminSesion = await prisma.sesionLog.create({
            data: {
                usuarioId: admin.id,
                rol: admin.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "adminhash",
            },
        });
        const padre = await crearUsuario("PARENT", "padre-a-cerrar@example.com");
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "abcd1234",
            },
        });
        mockToken = await createToken({ sub: admin.id, rol: admin.rol, sesionLogId: adminSesion.id });

        const res = await cerrarSesion(sesion.id, mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.sesionId).toBe(sesion.id);

        const cerrada = await prisma.sesionLog.findUnique({ where: { id: sesion.id } });
        expect(cerrada!.cerradaEn).not.toBeNull();
        expect(cerrada!.motivoCierre).toBe("FORZADA");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "SESION_FORZADA_CIERRE", tipoRecurso: "SesionLog", recursoId: sesion.id },
        });
        expect(audit).not.toBeNull();
        expect(audit!.usuarioId).toBe(admin.id);
    });

    it("devuelve 404 si la sesión no existe", async () => {
        const admin = await crearUsuario("ADMIN", "admin-noexiste@example.com");
        const adminSesion = await prisma.sesionLog.create({
            data: {
                usuarioId: admin.id,
                rol: admin.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "adminhash",
            },
        });
        mockToken = await createToken({ sub: admin.id, rol: admin.rol, sesionLogId: adminSesion.id });

        const res = await cerrarSesion("sesion-inexistente", mockToken);
        expect(res.status).toBe(404);
    });

    it("devuelve 404 si la sesión ya estaba cerrada", async () => {
        const admin = await crearUsuario("ADMIN", "admin-yacerrada@example.com");
        const adminSesion = await prisma.sesionLog.create({
            data: {
                usuarioId: admin.id,
                rol: admin.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "adminhash",
            },
        });
        const padre = await crearUsuario("PARENT", "padre-yacerrada@example.com");
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                cerradaEn: new Date(),
                motivoCierre: "INACTIVIDAD",
                ipHash: "abcd1234",
            },
        });
        mockToken = await createToken({ sub: admin.id, rol: admin.rol, sesionLogId: adminSesion.id });

        const res = await cerrarSesion(sesion.id, mockToken);
        expect(res.status).toBe(404);
    });
});
