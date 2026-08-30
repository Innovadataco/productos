import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { verifyPassword } from "@/lib/auth";
import { AutenticacionService } from "./autenticacion";

/**
 * SPEC-315 (002-PI-215): el reset por email debe limpiar `debeCambiarPassword`
 * (asimetría con cambiarPassword que ya lo limpiaba). Estos tests también cubren
 * la deuda preexistente de cobertura de restablecerPassword/cambiarPassword.
 */
describe("AutenticacionService · reset/cambio de password · SPEC-315", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    async function tokenValidoPara(email: string): Promise<string> {
        const svc = new AutenticacionService();
        const res = await svc.solicitarRecuperacion(email);
        if (res.ok && res.tipo === "ok") return res.token;
        throw new Error(`No se pudo generar token de recuperación: ${JSON.stringify(res)}`);
    }

    it("SC-001 · restablecerPassword limpia debeCambiarPassword (true → false)", async () => {
        const usuario = await crearUsuario("SCHOOL_ADMIN");
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: { debeCambiarPassword: true },
        });
        const token = await tokenValidoPara(usuario.email);

        const svc = new AutenticacionService();
        const res = await svc.restablecerPassword(token, "NuevaClave123");
        expect(res.ok).toBe(true);

        const after = await prisma.usuario.findUnique({ where: { id: usuario.id } });
        expect(after?.debeCambiarPassword).toBe(false);
    });

    it("SC-002 · restablecerPassword actualiza los otros 4 campos sin regresión", async () => {
        const usuario = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
                debeCambiarPassword: true,
                intentosFallidos: 3,
                estado: "bloqueado",
                bloqueadoHasta: new Date(Date.now() + 60_000),
            },
        });
        const token = await tokenValidoPara(usuario.email);

        const svc = new AutenticacionService();
        const res = await svc.restablecerPassword(token, "OtraClave456");
        expect(res.ok).toBe(true);

        const after = await prisma.usuario.findUnique({ where: { id: usuario.id } });
        expect(after?.intentosFallidos).toBe(0);
        expect(after?.estado).toBe("activo");
        expect(after?.bloqueadoHasta).toBeNull();
        expect(after?.debeCambiarPassword).toBe(false);
        // El hash quedó actualizado a la nueva clave (verifica el password real).
        expect(await verifyPassword("OtraClave456", after!.passwordHash)).toBe(true);
    });

    it("SC-002 · restablecerPassword marca el token como usado", async () => {
        const usuario = await crearUsuario("PARENT");
        const token = await tokenValidoPara(usuario.email);

        const svc = new AutenticacionService();
        await svc.restablecerPassword(token, "ClaveDefinitiva789");

        const tokens = await prisma.tokenRecuperacion.findMany({ where: { email: usuario.email } });
        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens.every((t) => t.usado)).toBe(true);
    });

    it("SC-003 · restablecerPassword con token inválido no modifica ningún usuario", async () => {
        const usuario = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: { debeCambiarPassword: true },
        });

        const svc = new AutenticacionService();
        const res = await svc.restablecerPassword("token-que-no-existe", "NoAplica123");
        expect(res.ok).toBe(false);

        const after = await prisma.usuario.findUnique({ where: { id: usuario.id } });
        // El flag NO cambió porque el token inválido no toca la BD.
        expect(after?.debeCambiarPassword).toBe(true);
    });

    it("bonus · cambiarPassword sigue limpiando debeCambiarPassword (:157 intacto)", async () => {
        const usuario = await crearUsuario("PARENT");
        // Fija una clave conocida para poder verificar el camino de cambiarPassword.
        const { hashPassword } = await import("@/lib/auth");
        const hashActual = await hashPassword("ClaveActual100");
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: { debeCambiarPassword: true, passwordHash: hashActual },
        });

        const svc = new AutenticacionService();
        const res = await svc.cambiarPassword({
            usuarioId: usuario.id,
            passwordActual: "ClaveActual100",
            passwordHashActual: hashActual,
            passwordNueva: "ClaveNueva200",
        });
        expect(res.ok).toBe(true);

        const after = await prisma.usuario.findUnique({ where: { id: usuario.id } });
        expect(after?.debeCambiarPassword).toBe(false);
    });
});
