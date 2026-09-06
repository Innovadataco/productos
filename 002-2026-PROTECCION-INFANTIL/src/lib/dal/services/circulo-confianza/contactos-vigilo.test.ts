/**
 * SPEC-325 (002-PI-225): "A quién vigilo" — nombre/parentesco propios y unicidad
 * por-padre con warn+override.
 * SPEC-540 (D-118): «Quitar» BORRA de verdad (hard-delete), distinto de «Pausar»
 * (activo=false, recuperable). Antes ambos eran baja lógica y se confundían.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes, crearPlataforma } from "@/lib/reporte-test-utils";
import {
    agregarContacto,
    actualizarContacto,
    eliminarContacto,
    verificarUnicidadIdentificador,
} from "./contactos-mutaciones";
import { listarContactos, obtenerDetalleContacto } from "./contactos";

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

    // SPEC-540 (D-118) · CANDADO de conducta: «Quitar» y «Pausar» son EXCLUYENTES.
    // Quitar borra de verdad (la fila y sus identificadores por cascade); Pausar deja
    // activo=false, recuperable. Antes ambos hacían activo=false y por eso «Quitar»
    // dejaba a la persona ahí con «Reanudar». Muere si Quitar vuelve a soft-delete.
    it("SPEC-540: «Quitar» BORRA el contacto y sus identificadores (hard-delete)", async () => {
        const padre = await crearUsuario("PARENT");
        const c = await agregarContacto(padre.id, {
            nombre: "Vecino",
            identificadores: [{ valor: "vecino_x" }],
        });
        await eliminarContacto(c.id, padre.id);
        // Desaparece de los dos lados: la fila ya no existe.
        expect(await prisma.contactoConfianza.findUnique({ where: { id: c.id } })).toBeNull();
        // Y sus identificadores caen por cascade (no quedan huérfanos).
        expect(await prisma.identificadorContacto.count({ where: { contactoId: c.id } })).toBe(0);
    });

    it("SPEC-540: «Pausar» (activo=false) NO borra — queda recuperable, distinto de Quitar", async () => {
        const padre = await crearUsuario("PARENT");
        const c = await agregarContacto(padre.id, {
            nombre: "Tía",
            identificadores: [{ valor: "tia_y" }],
        });
        await actualizarContacto(c.id, padre.id, { activo: false });
        const row = await prisma.contactoConfianza.findUnique({ where: { id: c.id } });
        expect(row).not.toBeNull(); // sigue existiendo
        expect(row?.activo).toBe(false); // pausado, recuperable con Reanudar
    });

    it("SPEC-540: la auditoría del borrado preserva el contacto y sus identificadores", async () => {
        const padre = await crearUsuario("PARENT");
        const c = await agregarContacto(padre.id, {
            nombre: "Vecino Auditado",
            identificadores: [{ valor: "vecino_aud" }],
        });
        await eliminarContacto(c.id, padre.id);
        const audit = await prisma.auditLog.findFirst({
            where: { tipoRecurso: "ContactoConfianza", recursoId: c.id, usuarioId: padre.id },
            orderBy: { creadoEn: "desc" },
        });
        expect(audit).not.toBeNull(); // quién + cuándo (creadoEn) + qué contacto
        const anterior = JSON.parse(audit?.valorAnterior ?? "{}");
        expect(anterior.nombre).toBe("Vecino Auditado");
        expect(anterior.identificadores?.some((i: { valor: string }) => i.valor === "vecino_aud")).toBe(true);
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

    describe("estado POR identificador (SPEC-325 · círculo)", () => {
        it("inactivar UNO no toca a los demás y el inactivo sigue visible en el detalle", async () => {
            const padre = await crearUsuario("PARENT");
            const c = await agregarContacto(padre.id, {
                nombre: "Tío Juan",
                identificadores: [{ valor: "juan_a" }, { valor: "juan_b" }],
            });
            const [a, b] = c.identificadores;

            await actualizarContacto(c.id, padre.id, {
                identificadores: [
                    { id: a.id, valor: a.valor, activo: false },
                    { id: b.id, valor: b.valor, activo: true },
                ],
            });

            const filas = await prisma.identificadorContacto.findMany({ where: { contactoId: c.id } });
            expect(filas).toHaveLength(2); // nadie se borró ni se duplicó
            expect(filas.find((i) => i.id === a.id)?.activo).toBe(false);
            expect(filas.find((i) => i.id === b.id)?.activo).toBe(true);
            // el contacto sigue habilitado: la baja fue de un identificador, no del contacto
            const row = await prisma.contactoConfianza.findUnique({ where: { id: c.id } });
            expect(row?.activo).toBe(true);
            // y el inactivo NO desaparece de la pantalla (si no, no habría cómo reactivarlo)
            const detalle = await obtenerDetalleContacto(c.id, padre.id);
            expect(detalle.identificadores.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
        });

        it("reactivar ACTUALIZA la misma fila, no crea una duplicada", async () => {
            const padre = await crearUsuario("PARENT");
            const c = await agregarContacto(padre.id, {
                nombre: "Vecino",
                identificadores: [{ valor: "vecino_x" }],
            });
            const ident = c.identificadores[0];

            await actualizarContacto(c.id, padre.id, {
                identificadores: [{ id: ident.id, valor: ident.valor, activo: false }],
            });
            await actualizarContacto(c.id, padre.id, {
                identificadores: [{ id: ident.id, valor: ident.valor, activo: true }],
            });

            const filas = await prisma.identificadorContacto.findMany({ where: { contactoId: c.id } });
            expect(filas).toHaveLength(1); // 🔴 antes se cargaban solo los activos → caía en create
            expect(filas[0].id).toBe(ident.id);
            expect(filas[0].activo).toBe(true);
        });

        it("agregar un identificador a un contacto ya creado conserva los anteriores", async () => {
            const padre = await crearUsuario("PARENT");
            const c = await agregarContacto(padre.id, {
                nombre: "Prima",
                identificadores: [{ valor: "prima_1" }],
            });
            const previo = c.identificadores[0];

            await actualizarContacto(c.id, padre.id, {
                identificadores: [
                    { id: previo.id, valor: previo.valor, activo: true },
                    { valor: "Prima_2", activo: true },
                ],
            });

            const filas = await prisma.identificadorContacto.findMany({ where: { contactoId: c.id } });
            expect(filas).toHaveLength(2);
            expect(filas.every((i) => i.activo)).toBe(true);
            expect(filas.map((i) => i.valor).sort()).toEqual(["prima_1", "prima_2"]); // normalizado
        });

        it("inhabilitar el CONTACTO manda sobre todos sus identificadores", async () => {
            const padre = await crearUsuario("PARENT");
            const c = await agregarContacto(padre.id, {
                nombre: "Desconocido",
                identificadores: [{ valor: "desc_1" }, { valor: "desc_2" }],
            });
            const [a, b] = c.identificadores;

            await actualizarContacto(c.id, padre.id, {
                activo: false,
                identificadores: [
                    { id: a.id, valor: a.valor, activo: true },
                    { id: b.id, valor: b.valor, activo: true },
                ],
            });

            const filas = await prisma.identificadorContacto.findMany({ where: { contactoId: c.id } });
            expect(filas.every((i) => !i.activo)).toBe(true); // nada queda vigilando
        });
    });
});
