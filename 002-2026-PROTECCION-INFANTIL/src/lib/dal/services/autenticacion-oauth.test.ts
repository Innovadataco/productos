/**
 * SPEC-590 + SPEC-631 — el servicio OAuth se parte en dos: `resolver` (solo busca por sub, luego email
 * con backfill; NUNCA crea) y `crearConRol` (alta con el rol firmado, allowlist forzado AL CREAR).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AutenticacionOauthService } from "./autenticacion-oauth";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { cuentaSinContrasenaLocal } from "@/lib/auth/cuenta-password";

const CTX = { ipAddress: "127.0.0.1", userAgent: "vitest" };

describe("AutenticacionOauthService · resolver (SPEC-590/631)", { timeout: 30_000 }, () => {
    const svc = new AutenticacionOauthService();
    beforeEach(async () => {
        await resetDatabase();
    });

    it("resuelve por googleSub aunque el email del token sea distinto (no duplica)", async () => {
        const cuenta = await crearUsuario("PARENT", "viejo@example.com");
        await prisma.usuario.update({ where: { id: cuenta.id }, data: { googleSub: "sub-1" } });
        const u = await svc.resolver({ email: "otro@example.com", proveedorSub: "sub-1" });
        expect(u?.id).toBe(cuenta.id);
        expect(u?.email).toBe("viejo@example.com"); // el sub manda; el email no se pisa
    });

    it("backfill: cuenta sin googleSub recibe el sub al resolverse por email", async () => {
        const cuenta = await crearUsuario("PARENT", "padre@example.com");
        const u = await svc.resolver({ email: "Padre@Example.com", proveedorSub: "sub-2" });
        expect(u?.id).toBe(cuenta.id);
        expect(u?.googleSub).toBe("sub-2");
    });

    it("no pisa un sub distinto: devuelve la cuenta del email intacta", async () => {
        const cuenta = await crearUsuario("PARENT", "x@example.com");
        await prisma.usuario.update({ where: { id: cuenta.id }, data: { googleSub: "sub-x" } });
        const u = await svc.resolver({ email: "x@example.com", proveedorSub: "sub-y" });
        expect(u?.id).toBe(cuenta.id);
        expect(u?.googleSub).toBe("sub-x");
    });

    it("SPEC-631: correo SIN cuenta → null, y NO crea nada", async () => {
        const u = await svc.resolver({ email: "desconocido@example.com", proveedorSub: "sub-none" });
        expect(u).toBeNull();
        expect(await prisma.usuario.count()).toBe(0);
    });
});

describe("AutenticacionOauthService · crearConRol (SPEC-631)", { timeout: 30_000 }, () => {
    const svc = new AutenticacionOauthService();
    beforeEach(async () => {
        await resetDatabase();
    });

    it("PARENT: googleSub, passwordCreadaEn null (SPEC-613 → cuentaSinContrasenaLocal) y auditoría", async () => {
        const u = await svc.crearConRol({ email: "Nueva@Example.com", nombre: "Nueva", proveedorSub: "sub-p", rol: "PARENT", ...CTX });
        expect(u.email).toBe("nueva@example.com");
        expect(u.googleSub).toBe("sub-p");
        expect(u.rol).toBe("PARENT");
        expect(u.passwordCreadaEn).toBeNull();
        expect(cuentaSinContrasenaLocal(u)).toBe(true);
        expect(await prisma.auditLog.findFirst({ where: { usuarioId: u.id, accion: "USER_CREATE" } })).not.toBeNull();
    });

    it("PARIDAD (gate 4): el PROFESIONAL nace SIN VerificacionProfesional ni PerfilProfesional (verificación downstream)", async () => {
        const u = await svc.crearConRol({ email: "profe@example.com", nombre: "Pro", proveedorSub: "sub-pro", rol: "PROFESIONAL", ...CTX });
        expect(u.rol).toBe("PROFESIONAL");
        expect(u.googleSub).toBe("sub-pro");
        expect(u.passwordCreadaEn).toBeNull();
        // Idéntico al alta por correo: nace PELADO — sin PerfilProfesional, así que NO es visible en el
        // directorio (solo con PerfilProfesional.estado=ACTIVO) ni puede ver casos. La verificación es
        // downstream (verificador) y cuelga del perfil: sin perfil, no hay verificación que saltar.
        expect(await prisma.perfilProfesional.count({ where: { usuarioId: u.id } }), "nace sin perfil").toBe(0);
    });

    it("PRIVILEGIO (gate 2): un rol NO auto-registrable → LANZA y no crea (ADMIN, SCHOOL_ADMIN)", async () => {
        await expect(
            svc.crearConRol({ email: "hacker@example.com", nombre: "H", proveedorSub: "sub-h", rol: "ADMIN", ...CTX }),
        ).rejects.toThrow(/no auto-registrable/);
        await expect(
            svc.crearConRol({ email: "colegio@example.com", nombre: "C", proveedorSub: "sub-c", rol: "SCHOOL_ADMIN", ...CTX }),
        ).rejects.toThrow(/no auto-registrable/);
        expect(await prisma.usuario.count(), "un rol privilegiado forjado no crea NADA").toBe(0);
    });
});
