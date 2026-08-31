/**
 * SPEC-325 (002-PI-225): "A quién protejo" — dos-padres-un-niño, desvinculación
 * por-padre y PII acceso-solo-dueño.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { registrarHijo, listarHijos, desvincularIdentificador } from "./hijos";

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
});
