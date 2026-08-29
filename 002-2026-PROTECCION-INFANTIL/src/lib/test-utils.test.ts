/**
 * SPEC-282 (002-PI-180): tests unitarios de la variante selectiva de resetDatabase().
 * Usa la BD real (política I-55/SPEC-174: no mockear el singleton de Prisma).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RolUsuario } from "@prisma/client";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";

describe("resetDatabase (SPEC-282)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("sin argumentos → vacía todas las tablas (comportamiento actual)", async () => {
        const usuario = await prisma.usuario.create({
            data: {
                email: `spec282-sin-args-${Date.now()}@t.co`,
                passwordHash: "h",
                rol: RolUsuario.PARENT,
                estado: "activo",
            },
        });
        expect(await prisma.usuario.count()).toBe(1);
        await resetDatabase();
        expect(await prisma.usuario.count()).toBe(0);
        expect(usuario.id).toBeDefined();
    });

    it("con lista explícita → vacía SOLO esas tablas (ModuloPermisible no tiene FK a Usuario)", async () => {
        // Siembra Usuario. ModuloPermisible ya fue sembrado por otorgarTodosLosPermisos()
        // en el beforeEach y no tiene FK a Usuario → CASCADE de Usuario no la afecta.
        await prisma.usuario.create({
            data: {
                email: `spec282-lista-${Date.now()}@t.co`,
                passwordHash: "h",
                rol: RolUsuario.PARENT,
                estado: "activo",
            },
        });
        expect(await prisma.usuario.count()).toBe(1);
        const modulosAntes = await prisma.moduloPermisible.count();
        expect(modulosAntes).toBeGreaterThan(0);

        // Reset selectivo: SOLO Usuario.
        await resetDatabase(["Usuario"]);

        expect(await prisma.usuario.count()).toBe(0);
        // ModuloPermisible sigue con sus filas (no depende de Usuario).
        expect(await prisma.moduloPermisible.count()).toBe(modulosAntes);
    });

    it("con tabla inexistente → lanza error explícito", async () => {
        await expect(resetDatabase(["TablaQueNoExiste"])).rejects.toThrow(/no encontrada/i);
    });

    it("con array vacío → NO trunca, pero SÍ re-otorga permisos", async () => {
        await prisma.usuario.create({
            data: {
                email: `spec282-vacio-${Date.now()}@t.co`,
                passwordHash: "h",
                rol: RolUsuario.PARENT,
                estado: "activo",
            },
        });
        // Borra permisos para verificar que reset([]) los re-otorga.
        await prisma.permisoModulo.deleteMany({});
        expect(await prisma.permisoModulo.count()).toBe(0);
        expect(await prisma.usuario.count()).toBe(1);

        await resetDatabase([]);

        // Usuario sigue (no se truncó).
        expect(await prisma.usuario.count()).toBe(1);
        // Permisos reconstruidos por otorgarTodosLosPermisos().
        expect(await prisma.permisoModulo.count()).toBeGreaterThan(0);
    });
});
