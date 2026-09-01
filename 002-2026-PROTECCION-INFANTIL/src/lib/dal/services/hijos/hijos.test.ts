/**
 * SPEC-325 (002-PI-225) + SPEC-339 (A-67 · D-4): "A quién protejo".
 *
 * SPEC-339 derogó la regla "dos padres, una ficha compartida". Los tests que
 * afirmaban ese comportamiento se reescribieron para afirmar el contrario, que
 * es la regla de Jelkin del 31-08-2026: cada padre tiene SU ficha, sus
 * interruptores y sus avisos, y nada de lo que hace uno toca al otro.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    registrarHijo,
    listarHijos,
    actualizarHijo,
    desvincularIdentificador,
    cambiarEstadoHijo,
    agregarIdentificador,
    cambiarEstadoIdentificador,
} from "./hijos";

describe("hijos · protejo (SPEC-325 · SPEC-339)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("registra un hijo con identificadores y lo lista para su padre", async () => {
        const padre = await crearUsuario("PARENT");
        const { hijoId } = await registrarHijo(padre.id, {
            nombre: "Juan",
            apellidos: "Pérez",
            documentoTipo: "TI",
            documentoNumero: "1001",
            anioNacimiento: 2015,
            sexo: "M",
            identificadores: [{ valor: "RobloxJuan" }],
        });
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

    // SPEC-339 (D-4) · este test afirmaba lo contrario hasta el 31-08-2026: que la
    // ficha era única y el 2º padre se enganchaba a la del 1º. Esa regla se derogó.
    it("dos padres, un mismo menor: cada uno obtiene SU ficha, no se enganchan", async () => {
        const papa = await crearUsuario("PARENT");
        const mama = await crearUsuario("PARENT");
        const r1 = await registrarHijo(papa.id, {
            nombre: "Ana", apellidos: "Gómez", documentoTipo: "TI", documentoNumero: "3003",
            identificadores: [{ valor: "AnaRoblox" }],
        });
        const r2 = await registrarHijo(mama.id, {
            nombre: "Ana", apellidos: "Gómez", documentoTipo: "TI", documentoNumero: "3003",
        });

        expect(r2.hijoId).not.toBe(r1.hijoId);
        expect(await prisma.hijo.count()).toBe(2);
        expect(await listarHijos(papa.id)).toHaveLength(1);
        const listaMama = await listarHijos(mama.id);
        expect(listaMama).toHaveLength(1);
        expect(listaMama[0].identificadores).toHaveLength(0);
    });

    it("un padre no puede repetir el mismo documento dentro de su propia lista", async () => {
        const padre = await crearUsuario("PARENT");
        await registrarHijo(padre.id, {
            nombre: "Ana", apellidos: "Gómez", documentoTipo: "TI", documentoNumero: "3100",
        });
        await expect(
            registrarHijo(padre.id, {
                nombre: "Ana María", apellidos: "Gómez", documentoTipo: "TI", documentoNumero: "3100",
            })
        ).rejects.toThrow(/ya está en tu lista/i);
        expect(await listarHijos(padre.id)).toHaveLength(1);
    });

    // SPEC-339 (D-4) · el defecto que motivó el cambio: el interruptor era global.
    it("un padre inactiva a su menor y el otro padre NO se entera", async () => {
        const papa = await crearUsuario("PARENT");
        const mama = await crearUsuario("PARENT");
        const r1 = await registrarHijo(papa.id, {
            nombre: "Leo", apellidos: "Ruiz", documentoTipo: "TI", documentoNumero: "3200",
        });
        await registrarHijo(mama.id, {
            nombre: "Leo", apellidos: "Ruiz", documentoTipo: "TI", documentoNumero: "3200",
        });

        await cambiarEstadoHijo(papa.id, r1.hijoId, "inactivo");

        expect((await listarHijos(papa.id))[0].estado).toBe("inactivo");
        expect((await listarHijos(mama.id))[0].estado).toBe("activo");
    });

    // SPEC-339 (FR-022 + D-4) · corregir datos sin reescribirle la ficha al otro.
    it("un padre corrige los datos de su menor y la ficha del otro NO cambia", async () => {
        const papa = await crearUsuario("PARENT");
        const mama = await crearUsuario("PARENT");
        const r1 = await registrarHijo(papa.id, {
            nombre: "Sofia", apellidos: "Mal Escrito", documentoTipo: "TI", documentoNumero: "3300",
        });
        await registrarHijo(mama.id, {
            nombre: "Sofía", apellidos: "Restrepo", documentoTipo: "TI", documentoNumero: "3300",
        });

        await actualizarHijo(papa.id, r1.hijoId, { apellidos: "Restrepo" });

        expect((await listarHijos(papa.id))[0].apellidos).toBe("Restrepo");
        expect((await listarHijos(mama.id))[0].nombre).toBe("Sofía");
        expect(await prisma.hijo.count()).toBe(2);
    });

    it("corregir el documento hacia uno que ya está en la propia lista se rechaza", async () => {
        const padre = await crearUsuario("PARENT");
        await registrarHijo(padre.id, {
            nombre: "Uno", apellidos: "Uno", documentoTipo: "TI", documentoNumero: "3400",
        });
        const segundo = await registrarHijo(padre.id, {
            nombre: "Dos", apellidos: "Dos", documentoTipo: "TI", documentoNumero: "3401",
        });
        await expect(
            actualizarHijo(padre.id, segundo.hijoId, { documentoNumero: "3400" })
        ).rejects.toThrow(/ya está en tu lista/i);
    });

    it("PII: un padre no dueño no puede corregir los datos de un menor ajeno", async () => {
        const dueno = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        const { hijoId } = await registrarHijo(dueno.id, {
            nombre: "Mia", apellidos: "Cruz", documentoTipo: "TI", documentoNumero: "3500",
        });
        await expect(actualizarHijo(ajeno.id, hijoId, { nombre: "Otro" })).rejects.toThrow(/no encontrado/i);
    });

    // SPEC-339 (D-4) · antes la fila era compartida y "quitar" solo la ocultaba de
    // la vista de quien la quitaba. Con ficha propia, quitar es quitar.
    it("quitar un identificador lo elimina de verdad de la ficha de su padre", async () => {
        const papa = await crearUsuario("PARENT");
        const mama = await crearUsuario("PARENT");
        await registrarHijo(papa.id, {
            nombre: "Leo", apellidos: "Ruiz", documentoTipo: "TI", documentoNumero: "4004",
            identificadores: [{ valor: "LeoGamer" }],
        });
        await registrarHijo(mama.id, {
            nombre: "Leo", apellidos: "Ruiz", documentoTipo: "TI", documentoNumero: "4004",
            identificadores: [{ valor: "LeoGamer" }],
        });

        const identPapa = (await listarHijos(papa.id))[0].identificadores[0].id;
        await desvincularIdentificador(papa.id, identPapa);

        expect((await listarHijos(papa.id))[0].identificadores).toHaveLength(0);
        // mamá conserva el suyo: son filas distintas, de fichas distintas
        expect((await listarHijos(mama.id))[0].identificadores).toHaveLength(1);
        expect(await prisma.identificadorHijo.count()).toBe(1);
    });

    it("PII: un padre no dueño no puede desvincular el identificador de otro (acceso solo por dueño)", async () => {
        const dueno = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        await registrarHijo(dueno.id, {
            nombre: "Mia",
            apellidos: "Cruz",
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
            nombre: "Sara", apellidos: "Prueba", documentoTipo: "TI", documentoNumero: "6006",
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
            nombre: "Dan", apellidos: "Prueba", documentoTipo: "TI", documentoNumero: "7007",
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

    it("activar/inactivar un identificador de la propia ficha; la lista lo muestra con su estado", async () => {
        const padre = await crearUsuario("PARENT");
        const ajeno = await crearUsuario("PARENT");
        await registrarHijo(padre.id, {
            nombre: "Emi", apellidos: "Prueba", documentoTipo: "TI", documentoNumero: "8008",
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
