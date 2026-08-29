/**
 * E-8: tests del PermisoModuloRepository — árbol de módulos, snapshot y
 * aplicación transaccional de cambios (upsert por rol+módulo).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { PermisoModuloRepository } from "./permiso-modulo";

describe("PermisoModuloRepository", () => {
    beforeEach(async () => {
        // resetDatabase ya siembra los módulos y otorga permisos a todos los roles
        // (llamar otorgarTodosLosPermisos de nuevo duplicaría las claves).
        await resetDatabase();
    });

    it("listarArbolModulos devuelve raíces con submódulos ordenados y listarTodos el permiso por rol", async () => {
        const repo = new PermisoModuloRepository();

        const arbol = await repo.listarArbolModulos();
        expect(arbol.length).toBeGreaterThan(0);
        expect(arbol.every((m) => m.padreId === null)).toBe(true);
        const ordenes = arbol.map((m) => m.orden);
        expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));

        const todos = await repo.listarTodos();
        expect(todos.length).toBeGreaterThan(0);
        expect(todos[0]).toHaveProperty("rol");
        expect(todos[0]).toHaveProperty("moduloId");
        expect(todos[0]).toHaveProperty("activo");
    });

    it("snapshotDe y aplicarCambios: crea y actualiza el permiso en una transacción", async () => {
        const admin = await crearUsuario("ADMIN", "admin-permisos@test.local");
        const modulo = await prisma.moduloPermisible.findFirst();
        const repo = new PermisoModuloRepository();

        const antes = await repo.snapshotDe([{ rol: "PARENT", moduloId: modulo!.id, activo: false }]);
        expect(antes[0].activo, "estado inicial activo (otorgado a todos)").toBe(true);

        await repo.aplicarCambios([{ rol: "PARENT", moduloId: modulo!.id, activo: false }], admin.id);
        const actualizado = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol: "PARENT", moduloId: modulo!.id } },
        });
        expect(actualizado?.activo, "el cambio quedó aplicado").toBe(false);
        expect(actualizado?.actualizadoPorId).toBe(admin.id);

        // Y crea la fila si no existe (upsert de un rol nuevo)
        await repo.aplicarCambios([{ rol: "OPERADOR", moduloId: modulo!.id, activo: true }], admin.id);
        const creado = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol: "OPERADOR", moduloId: modulo!.id } },
        });
        expect(creado?.activo).toBe(true);
    });
});
