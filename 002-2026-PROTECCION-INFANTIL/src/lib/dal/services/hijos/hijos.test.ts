/**
 * SPEC-325 (002-PI-225): "A quién protejo" — dos-padres-un-niño, desvinculación
 * por-padre y PII acceso-solo-dueño.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    registrarHijo,
    listarHijos,
    desvincularIdentificador,
    cambiarEstadoHijo,
    agregarIdentificador,
    cambiarEstadoIdentificador,
} from "./hijos";

describe("hijos · protejo (SPEC-325)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("registra un hijo con identificadores y lo lista para su padre", async () => {
        const padre = await crearUsuario("PARENT");
        const { hijoId, vinculadoAExistente } = await registrarHijo(padre.id, {
            nombre: "Juan",
            apellidos: "Pérez",
            documentoTipo: "TI",
            documentoNumero: "1001",
            anioNacimiento: 2015,
            sexo: "M",
            identificadores: [{ valor: "RobloxJuan" }],
        });
        expect(vinculadoAExistente).toBe(false);
        const lista = await listarHijos(padre.id);
        expect(lista).toHaveLength(1);
        expect(lista[0].id).toBe(hijoId);
        // el identificador se guardó normalizado (mecanismo compartido)
        expect(lista[0].identificadores[0].valor).toBe("robloxjuan");
    });

    it("un familiar que no es hijo entra igual", async () => {
        const padre = await crearUsuario("PARENT");
        await registrarHijo(padre.id, {
            nombre: "Santiago",
            apellidos: "Sobrino",
            documentoTipo: "RC",
            documentoNumero: "2002",
        });
        expect(await listarHijos(padre.id)).toHaveLength(1);
    });

    it("dos padres, un niño (mismo documento): no duplica, comparte datos, vincula al 2º", async () => {
        const papa = await crearUsuario("PARENT");
        const mama = await crearUsuario("PARENT");
        const r1 = await registrarHijo(papa.id, {
            nombre: "Ana",
            documentoTipo: "TI",
            documentoNumero: "3003",
            identificadores: [{ valor: "AnaRoblox" }],
        });
        const r2 = await registrarHijo(mama.id, {
            nombre: "Ana",
            documentoTipo: "TI",
            documentoNumero: "3003",
        });
        expect(r2.vinculadoAExistente).toBe(true);
        expect(r2.hijoId).toBe(r1.hijoId);
        // un solo Hijo en la BD
        expect(await prisma.hijo.count()).toBe(1);
        // ambos padres lo ven, con el identificador compartido
        expect(await listarHijos(papa.id)).toHaveLength(1);
        const listaMama = await listarHijos(mama.id);
        expect(listaMama).toHaveLength(1);
        expect(listaMama[0].identificadores[0].valor).toBe("anaroblox");
    });

    it("quitar un identificador solo lo desvincula de la vista de quien lo quita, sin borrarlo para el otro", async () => {
        const papa = await crearUsuario("PARENT");
        const mama = await crearUsuario("PARENT");
        await registrarHijo(papa.id, {
            nombre: "Leo",
            documentoTipo: "TI",
            documentoNumero: "4004",
            identificadores: [{ valor: "LeoGamer" }],
        });
        await registrarHijo(mama.id, { nombre: "Leo", documentoTipo: "TI", documentoNumero: "4004" });

        const identId = (await listarHijos(papa.id))[0].identificadores[0].id;
        await desvincularIdentificador(papa.id, identId);

        // papá ya no lo ve
        expect((await listarHijos(papa.id))[0].identificadores).toHaveLength(0);
        // mamá sí lo sigue viendo (no se borró)
        expect((await listarHijos(mama.id))[0].identificadores).toHaveLength(1);
        // la fila sigue existiendo
        expect(await prisma.identificadorHijo.count()).toBe(1);
    });

    it("PII: un padre no dueño no puede desvincular el identificador de otro (acceso solo por dueño)", async () => {
        const dueno = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        await registrarHijo(dueno.id, {
            nombre: "Mia",
            documentoTipo: "TI",
            documentoNumero: "5005",
            identificadores: [{ valor: "MiaX" }],
        });
        const identId = (await listarHijos(dueno.id))[0].identificadores[0].id;
        await expect(desvincularIdentificador(ajeno.id, identId)).rejects.toThrow(/no encontrado/i);
    });

    // SPEC-325 (extensión): estado del hijo + varios identificadores + activar/inactivar identificador.
    it("un hijo nace activo; se puede inactivar y reactivar (solo el dueño)", async () => {
        const padre = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        const { hijoId } = await registrarHijo(padre.id, {
            nombre: "Sara", documentoTipo: "TI", documentoNumero: "6006",
        });
        expect((await listarHijos(padre.id))[0].estado).toBe("activo");

        await cambiarEstadoHijo(padre.id, hijoId, "inactivo");
        expect((await listarHijos(padre.id))[0].estado).toBe("inactivo");
        await cambiarEstadoHijo(padre.id, hijoId, "activo");
        expect((await listarHijos(padre.id))[0].estado).toBe("activo");

        await expect(cambiarEstadoHijo(ajeno.id, hijoId, "inactivo")).rejects.toThrow(/no encontrado/i);
    });

    it("agrega varios identificadores a un hijo ya creado; dedup; solo el dueño", async () => {
        const padre = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        const { hijoId } = await registrarHijo(padre.id, {
            nombre: "Dan", documentoTipo: "TI", documentoNumero: "7007",
            identificadores: [{ valor: "DanRoblox" }],
        });
        await agregarIdentificador(padre.id, hijoId, { valor: "DanTel", tipo: "telefono" });
        const ids = (await listarHijos(padre.id))[0].identificadores;
        expect(ids.map((i) => i.valor).sort()).toEqual(["danroblox", "dantel"]);

        // dedup: agregar uno igual (normalizado) no duplica
        const dup = await agregarIdentificador(padre.id, hijoId, { valor: "DANROBLOX" });
        expect(dup.yaExistia).toBe(true);
        expect((await listarHijos(padre.id))[0].identificadores).toHaveLength(2);

        await expect(agregarIdentificador(ajeno.id, hijoId, { valor: "X" })).rejects.toThrow(/no encontrado/i);
    });

    it("activar/inactivar un identificador (flag global); la lista lo muestra con su estado", async () => {
        const padre = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        await registrarHijo(padre.id, {
            nombre: "Emi", documentoTipo: "TI", documentoNumero: "8008",
            identificadores: [{ valor: "EmiChat" }],
        });
        const ident = (await listarHijos(padre.id))[0].identificadores[0];
        expect(ident.activo).toBe(true);

        await cambiarEstadoIdentificador(padre.id, ident.id, false);
        const tras = (await listarHijos(padre.id))[0].identificadores;
        expect(tras).toHaveLength(1); // sigue visible (para reactivar), pero inactivo
        expect(tras[0].activo).toBe(false);

        await cambiarEstadoIdentificador(padre.id, ident.id, true);
        expect((await listarHijos(padre.id))[0].identificadores[0].activo).toBe(true);

        await expect(cambiarEstadoIdentificador(ajeno.id, ident.id, false)).rejects.toThrow(/no encontrado/i);
    });
});
