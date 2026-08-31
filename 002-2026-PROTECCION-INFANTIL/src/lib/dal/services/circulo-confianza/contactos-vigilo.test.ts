/**
 * SPEC-325 (002-PI-225): "A quién vigilo" — nombre/parentesco propios, baja
 * lógica (DELETE), y unicidad por-padre con warn+override.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import {
    agregarContacto,
    eliminarContacto,
    verificarUnicidadIdentificador,
} from "./contactos-mutaciones";

describe("contactos vigilo (SPEC-325)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
    });

    it("guarda nombre y parentesco como campos propios", async () => {
        const padre = await crearUsuario("PARENT");
        const c = await agregarContacto(padre.id, {
            nombre: "Tío Juan",
            parentesco: "tío",
            identificadores: [{ valor: "TioJuan1" }],
        });
        const row = await prisma.contactoConfianza.findUnique({ where: { id: c.id } });
        expect(row?.nombre).toBe("Tío Juan");
        expect(row?.parentesco).toBe("tío");
        // identificador guardado normalizado (mecanismo compartido)
        expect(c.identificadores[0].valor).toBe("tiojuan1");
    });

    it("eliminar contacto = baja lógica (activo=false), no hard-delete", async () => {
        const padre = await crearUsuario("PARENT");
        const c = await agregarContacto(padre.id, {
            nombre: "Vecino",
            identificadores: [{ valor: "vecino_x" }],
        });
        await eliminarContacto(c.id, padre.id);
        const row = await prisma.contactoConfianza.findUnique({ where: { id: c.id } });
        expect(row).not.toBeNull(); // sigue existiendo
        expect(row?.activo).toBe(false);
        // sus identificadores también quedan inactivos
        const idents = await prisma.identificadorContacto.findMany({ where: { contactoId: c.id } });
        expect(idents.every((i) => !i.activo)).toBe(true);
    });

    it("no deja eliminar un contacto ajeno", async () => {
        const dueno = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        const c = await agregarContacto(dueno.id, {
            nombre: "X",
            identificadores: [{ valor: "x1" }],
        });
        await expect(eliminarContacto(c.id, ajeno.id)).rejects.toThrow(/no encontrado/i);
    });

    it("unicidad por-padre: warn+override dice a quién pertenece (case-insensitive)", async () => {
        const padre = await crearUsuario("PARENT");
        await agregarContacto(padre.id, {
            nombre: "Tío Juan",
            identificadores: [{ valor: "TioJuan1" }],
        });
        // mismo identificador con otro case → detectado, no bloqueado
        const res = await verificarUnicidadIdentificador(padre.id, "tiojuan1");
        expect(res.duplicado).toBe(true);
        expect(res.perteneceA).toBe("Tío Juan");
        // identificador distinto → no duplicado
        expect((await verificarUnicidadIdentificador(padre.id, "otro_id")).duplicado).toBe(false);
    });
});
