/**
 * SPEC-590 — resolución de cuenta OAuth: primero por `googleSub` (inmutable),
 * después por email con backfill del sub. El email del padre es editable desde
 * el perfil; la resolución por sub es lo que evita cuentas duplicadas cuando
 * cambia.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AutenticacionOauthService } from "./autenticacion-oauth";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";

const CTX = { ipAddress: "127.0.0.1", userAgent: "vitest" };

describe("AutenticacionOauthService (SPEC-590)", { timeout: 30_000 }, () => {
    const svc = new AutenticacionOauthService();

    beforeEach(async () => {
        await resetDatabase();
    });

    it("resuelve por googleSub aunque el email del token sea distinto (no duplica)", async () => {
        const cuenta = await crearUsuario("PARENT", "viejo@example.com");
        await prisma.usuario.update({ where: { id: cuenta.id }, data: { googleSub: "sub-1" } });

        const r = await svc.resolverODeCrearCuenta({
            email: "otro@example.com",
            nombre: "Padre",
            proveedorSub: "sub-1",
            ...CTX,
        });

        expect(r.esNuevo).toBe(false);
        expect(r.usuario.id).toBe(cuenta.id);
        // El email de la cuenta NO se pisa con el del token: el sub manda.
        expect(r.usuario.email).toBe("viejo@example.com");
    });

    it("backfill: cuenta sin googleSub recibe el sub al resolverse por email", async () => {
        const cuenta = await crearUsuario("PARENT", "padre@example.com");

        const r = await svc.resolverODeCrearCuenta({
            email: "Padre@Example.com",
            nombre: null,
            proveedorSub: "sub-2",
            ...CTX,
        });

        expect(r.esNuevo).toBe(false);
        expect(r.usuario.id).toBe(cuenta.id);
        expect(r.usuario.googleSub).toBe("sub-2");
    });

    it("no pisa un sub distinto: la cuenta del email se devuelve intacta", async () => {
        const cuenta = await crearUsuario("PARENT", "x@example.com");
        await prisma.usuario.update({ where: { id: cuenta.id }, data: { googleSub: "sub-x" } });

        const r = await svc.resolverODeCrearCuenta({
            email: "x@example.com",
            nombre: null,
            proveedorSub: "sub-y",
            ...CTX,
        });

        expect(r.esNuevo).toBe(false);
        expect(r.usuario.id).toBe(cuenta.id);
        expect(r.usuario.googleSub).toBe("sub-x");
    });

    it("cuenta nueva: persiste googleSub, rol PARENT y auditoría USER_CREATE", async () => {
        const r = await svc.resolverODeCrearCuenta({
            email: "Nueva@Example.com",
            nombre: "Nueva",
            proveedorSub: "sub-nueva",
            ...CTX,
        });

        expect(r.esNuevo).toBe(true);
        expect(r.usuario.email).toBe("nueva@example.com");
        expect(r.usuario.googleSub).toBe("sub-nueva");
        expect(r.usuario.rol).toBe("PARENT");
        expect(r.usuario.estado).toBe("activo");

        const auditoria = await prisma.auditLog.findFirst({
            where: { usuarioId: r.usuario.id, accion: "USER_CREATE" },
        });
        expect(auditoria).not.toBeNull();
    });
});
