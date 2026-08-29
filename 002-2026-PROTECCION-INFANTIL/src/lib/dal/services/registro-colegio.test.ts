import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPaisCiudad } from "@/lib/reporte-test-utils";
import { RegistroColegioService } from "./registro-colegio";
import { verifyPassword } from "@/lib/auth";

async function seedUbicacionYParametros() {
    await crearPaisCiudad();
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.invitacion.token_vigencia_horas" },
        update: { valor: "48" },
        create: {
            clave: "pagos.invitacion.token_vigencia_horas",
            valor: "48",
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "Horas de vigencia del link de activación de cuenta de rector",
        },
    });
}

describe("RegistroColegioService (SPEC-240)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedUbicacionYParametros();
    });

    it("registrarPublico crea colegio, tenant y rector REGISTRADO", async () => {
        const service = new RegistroColegioService();
        const resultado = await service.registrarPublico(
            "rector@colegio.edu",
            "Password1",
            "Ana Rector",
            "Colegio Ejemplo"
        );

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;

        expect(resultado.user.email).toBe("rector@colegio.edu");
        expect(resultado.user.rol).toBe("SCHOOL_ADMIN");

        const user = await prisma.usuario.findUnique({ where: { id: resultado.user.id }, include: { colegio: true, tenant: true } });
        expect(user).not.toBeNull();
        expect(user!.estadoActivacion).toBe("REGISTRADO");
        expect(user!.colegio).not.toBeNull();
        expect(user!.colegio!.nombre).toBe("Colegio Ejemplo");
        expect(user!.tenantId).toBe(user!.colegio!.tenantId);

        const valid = await verifyPassword("Password1", user!.passwordHash);
        expect(valid).toBe(true);
    });

    it("registrarPublico rechaza email duplicado", async () => {
        const service = new RegistroColegioService();
        await service.registrarPublico("rector@colegio.edu", "Password1", "Ana Rector", "Colegio Ejemplo");

        const resultado = await service.registrarPublico(
            "rector@colegio.edu",
            "Password2",
            "Otro Rector",
            "Otro Colegio"
        );

        expect(resultado.ok).toBe(false);
        if (resultado.ok) return;
        expect(resultado.tipo).toBe("existente");
    });

    it("preRegistrarPorAdmin crea colegio y rector INVITADO con token", async () => {
        const service = new RegistroColegioService();
        const resultado = await service.preRegistrarPorAdmin(
            "Colegio Admin",
            "Pedro Rector",
            "pedro@colegio.edu",
            "admin-id"
        );

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;

        expect(resultado.token).toHaveLength(64);
        expect(resultado.colegioNombre).toBe("Colegio Admin");

        const user = await prisma.usuario.findUnique({ where: { id: resultado.user.id } });
        expect(user).not.toBeNull();
        expect(user!.estadoActivacion).toBe("INVITADO");
        expect(user!.tokenInvitacion).toBe(resultado.token);
        expect(user!.tokenInvitacionExpiraEn).not.toBeNull();
        expect(user!.tokenInvitacionExpiraEn!.getTime()).toBeGreaterThan(Date.now());
    });

    it("activarPorToken consume token y define contraseña", async () => {
        const service = new RegistroColegioService();
        const pre = await service.preRegistrarPorAdmin(
            "Colegio Activar",
            "María Rector",
            "maria@colegio.edu",
            "admin-id"
        );
        expect(pre.ok).toBe(true);
        if (!pre.ok) return;

        const resultado = await service.activarPorToken(pre.token, "NuevaPass1");

        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;
        expect(resultado.user.email).toBe("maria@colegio.edu");
        expect(resultado.user.rol).toBe("SCHOOL_ADMIN");

        const user = await prisma.usuario.findUnique({ where: { id: resultado.user.id } });
        expect(user).not.toBeNull();
        expect(user!.estadoActivacion).toBe("REGISTRADO");
        expect(user!.tokenInvitacion).toBeNull();
        expect(user!.tokenInvitacionExpiraEn).toBeNull();

        const valid = await verifyPassword("NuevaPass1", user!.passwordHash);
        expect(valid).toBe(true);
    });

    it("activarPorToken rechaza token inexistente", async () => {
        const service = new RegistroColegioService();
        const resultado = await service.activarPorToken("token-inexistente", "NuevaPass1");
        expect(resultado.ok).toBe(false);
        if (resultado.ok) return;
        expect(resultado.tipo).toBe("invalido");
    });

    it("activarPorToken rechaza token expirado", async () => {
        const service = new RegistroColegioService();
        const pre = await service.preRegistrarPorAdmin(
            "Colegio Expirado",
            "Luis Rector",
            "luis@colegio.edu",
            "admin-id"
        );
        expect(pre.ok).toBe(true);
        if (!pre.ok) return;

        await prisma.usuario.update({
            where: { id: pre.user.id },
            data: { tokenInvitacionExpiraEn: new Date(Date.now() - 1000) },
        });

        const resultado = await service.activarPorToken(pre.token, "NuevaPass1");
        expect(resultado.ok).toBe(false);
        if (resultado.ok) return;
        expect(resultado.tipo).toBe("expirado");
    });

    it("activarPorToken rechaza token ya usado", async () => {
        const service = new RegistroColegioService();
        const pre = await service.preRegistrarPorAdmin(
            "Colegio Usado",
            "Carmen Rector",
            "carmen@colegio.edu",
            "admin-id"
        );
        expect(pre.ok).toBe(true);
        if (!pre.ok) return;

        await service.activarPorToken(pre.token, "NuevaPass1");
        const segundo = await service.activarPorToken(pre.token, "OtraPass2");

        expect(segundo.ok).toBe(false);
        if (segundo.ok) return;
        // Una vez consumido el token se anula; el sistema no distingue usado de inexistente.
        expect(segundo.tipo).toBe("invalido");
    });
});
