/**
 * CANDADO · SPEC-896 (revocación de sesión) — logout y reset/cambio de clave CIERRAN la SesionLog.
 *
 * Antes, logout solo borraba cookies y reset/cambio no tocaban la SesionLog → un JWT robado sobrevivía al
 * logout y al reset hasta su `exp` (24h), revivible con /api/session/ping. Control positivo: sin el cierre,
 * `cerradaEn` seguiría null y `pingSesion` seguiría aceptando el token → estos tests quedarían en rojo.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";
import { SessionLogService } from "@/lib/dal/services/session-log";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { POST as logoutPOST } from "./route";

let activeToken: string | null = null;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "__Host-token" && activeToken ? { name, value: activeToken } : undefined),
        set: vi.fn(),
    }),
}));

function req(): Request {
    return new Request("http://localhost:5005/x", {
        headers: { "user-agent": "candado-896", "x-forwarded-for": "1.2.3.4" },
    });
}

async function crearSesion(usuarioId: string, rol: RolUsuario): Promise<string> {
    return new SessionLogService().registrarInicioSesion(req(), { id: usuarioId, rol });
}

async function sesionesAbiertas(usuarioId: string): Promise<number> {
    return prisma.sesionLog.count({ where: { usuarioId, cerradaEn: null } });
}

describe("SPEC-896 · revocación de sesión (logout + reset/cambio)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    it("logout cierra la SesionLog del JWT y deja la sesión NO revivible por ping", async () => {
        const user = await crearUsuario("PARENT");
        const sesionId = await crearSesion(user.id, "PARENT");
        activeToken = await createToken({ sub: user.id, rol: "PARENT", sesionLogId: sesionId });

        const res = await logoutPOST();
        expect(res.status).toBe(200);

        const sesion = await prisma.sesionLog.findUnique({ where: { id: sesionId } });
        expect(sesion?.cerradaEn, "logout dejó la SesionLog cerrada").not.toBeNull();

        // Anti-replay: la sesión cerrada NO se puede revivir con un ping.
        const revivible = await new SessionLogService().pingSesion(sesionId, user.id);
        expect(revivible, "ping sobre sesión cerrada → rechazado").toBe(false);
    });

    it("cambiarPassword cierra TODAS las sesiones activas del usuario", async () => {
        const user = await crearUsuario("PARENT");
        const full = await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } });
        await crearSesion(user.id, "PARENT");
        await crearSesion(user.id, "PARENT");
        expect(await sesionesAbiertas(user.id)).toBe(2);

        const res = await new AutenticacionService().cambiarPassword({
            usuarioId: user.id,
            passwordActual: "TestPass123",
            passwordNueva: "NuevaClave456",
            passwordHashActual: full.passwordHash,
        });
        expect(res.ok).toBe(true);
        expect(await sesionesAbiertas(user.id), "cambio de clave expulsa toda sesión viva").toBe(0);
    });

    it("restablecerPassword cierra TODAS las sesiones activas del usuario", async () => {
        const user = await crearUsuario("PARENT");
        await crearSesion(user.id, "PARENT");
        await crearSesion(user.id, "PARENT");
        expect(await sesionesAbiertas(user.id)).toBe(2);

        const svc = new AutenticacionService();
        const sol = await svc.solicitarRecuperacion(user.email);
        if (!(sol.ok && sol.tipo === "ok")) throw new Error(`no se pudo generar token: ${JSON.stringify(sol)}`);
        const res = await svc.restablecerPassword(sol.token, "NuevaClave789");
        expect(res.ok).toBe(true);
        expect(await sesionesAbiertas(user.id), "reset preventivo expulsa toda sesión viva").toBe(0);
    });

    it("no cierra sesiones de OTRO usuario (el cierre es por usuarioId)", async () => {
        const victima = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const sesionOtro = await crearSesion(otro.id, "PARENT");
        const fullVictima = await prisma.usuario.findUniqueOrThrow({ where: { id: victima.id } });
        await crearSesion(victima.id, "PARENT");

        await new AutenticacionService().cambiarPassword({
            usuarioId: victima.id,
            passwordActual: "TestPass123",
            passwordNueva: "NuevaClave456",
            passwordHashActual: fullVictima.passwordHash,
        });
        const sesion = await prisma.sesionLog.findUnique({ where: { id: sesionOtro } });
        expect(sesion?.cerradaEn, "la sesión de otro usuario queda intacta").toBeNull();
    });
});
