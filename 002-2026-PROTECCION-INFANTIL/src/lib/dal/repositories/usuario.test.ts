/**
 * E-8 (LOTE 2): tests de findOperadorActivoConCupo (reasignación de casos).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { UsuarioRepository } from "./usuario";

describe("UsuarioRepository (E-8 LOTE 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve el operador activo con el cupo de su perfil", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id, cupoMaximo: 7 },
        });

        const row = await new UsuarioRepository().findOperadorActivoConCupo(operador.id);
        expect(row).not.toBeNull();
        expect(row!.id).toBe(operador.id);
        expect(row!.perfilOperador).toMatchObject({ cupoMaximo: 7 });
    });

    it("no devuelve operadores inactivos ni usuarios de otro rol", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id },
        });
        await prisma.usuario.update({ where: { id: operador.id }, data: { estado: "inactivo" } });

        const repo = new UsuarioRepository();
        expect(await repo.findOperadorActivoConCupo(operador.id)).toBeNull();
        expect(await repo.findOperadorActivoConCupo(admin.id)).toBeNull();
        expect(await repo.findOperadorActivoConCupo("no-existe")).toBeNull();
    });
});
