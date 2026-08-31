/**
 * SPEC-325 (002-PI-225): "A quién vigilo" — nombre/parentesco propios, baja
 * lógica (DELETE), y unicidad por-padre con warn+override.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes, crearPlataforma } from "@/lib/reporte-test-utils";
import {
    agregarContacto,
    eliminarContacto,
    verificarUnicidadIdentificador,
} from "./contactos-mutaciones";
import { listarContactos } from "./contactos";

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

    it("🔴 defecto silencioso: contacto guardado 'TioJuan1' CRUZA un reporte 'tiojuan1'", async () => {
        // Este es el fix estrella (§3.3 / evidencia §6.7): antes el contacto se
        // guardaba crudo ('TioJuan1') y el reporte llegaba en otro case ('tiojuan1')
        // → no cruzaba y no avisaba. Ahora ambos lados normalizan al mismo valor.
        const padre = await crearUsuario("PARENT");
        const plat = await crearPlataforma("roblox", "Roblox", "juegos");
        // El padre guarda el identificador con mayúsculas.
        await agregarContacto(padre.id, {
            nombre: "Tío Juan",
            identificadores: [{ valor: "TioJuan1", plataformaId: plat.id }],
        });
        // Alguien reporta el mismo identificador en minúsculas. Insertamos el
        // reporte ya en la forma canónica (como lo deja el embudo de creación de
        // reporte, reporte-creation.ts) en un estado que cruza (REVISION_MANUAL).
        await prisma.reporte.create({
            data: {
                identificador: "tiojuan1",
                plataformaId: plat.id,
                texto: "reporte de prueba",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                estado: "REVISION_MANUAL",
            },
        });
        const { contactos } = await listarContactos(padre.id);
        expect(contactos).toHaveLength(1);
        // el contacto ahora VE el reporte (cruce case-insensitive) — antes daba 0
        expect(contactos[0].totalReportes).toBe(1);
        expect(contactos[0].estado).not.toBe("sinReportes");
    });
});
