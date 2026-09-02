/**
 * A-70 · F10 — bitácora del menor.
 *
 * Los asserts van contra las llamadas REALES de `hijos/hijos.ts` (no contra
 * filas de AuditLog escritas a mano): si mañana alguien cambia la forma del
 * metadato, este test se cae, que es exactamente lo que debe pasar.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    registrarHijo,
    cambiarEstadoHijo,
    agregarIdentificador,
    cambiarEstadoIdentificador,
    desvincularIdentificador,
    actualizarHijo,
} from "./hijos/hijos";
import { bitacoraDelMenor } from "./bitacora-menor";

async function crearPadre(sufijo: string) {
    return crearUsuario("PARENT", `padre-bitacora-${sufijo}-${Date.now()}@test.local`);
}

let secuenciaDocumento = 0;

async function crearMenor(usuarioId: string, nombre = "Sofía") {
    secuenciaDocumento += 1;
    const { hijoId } = await registrarHijo(usuarioId, {
        nombre,
        apellidos: "Pérez",
        documentoTipo: "TI",
        documentoNumero: `${Date.now()}${secuenciaDocumento}`.slice(-10),
    });
    return hijoId;
}

describe("bitacoraDelMenor", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("el primer hito es el alta y define desde cuándo se está monitoreando", async () => {
        const padre = await crearPadre("alta");
        const hijoId = await crearMenor(padre.id, "Sofía");

        const bitacora = await bitacoraDelMenor(hijoId, padre.id);

        expect(bitacora.hitos).toHaveLength(1);
        expect(bitacora.hitos[0].tipo).toBe("menor_registrado");
        expect(bitacora.hitos[0].descripcion).toContain("Sofía");
        expect(bitacora.monitoreadoDesde).toEqual(bitacora.hitos[0].fecha);
        expect(bitacora.nombre).toBe("Sofía");
    });

    it("registra el alta, la pausa y la reactivación de la ficha en orden", async () => {
        const padre = await crearPadre("estados");
        const hijoId = await crearMenor(padre.id);

        await cambiarEstadoHijo(padre.id, hijoId, "inactivo");
        await cambiarEstadoHijo(padre.id, hijoId, "activo");

        const { hitos, monitoreadoDesde } = await bitacoraDelMenor(hijoId, padre.id);

        expect(hitos.map((h) => h.tipo)).toEqual([
            "menor_registrado",
            "menor_inactivado",
            "menor_activado",
        ]);
        // El más antiguo manda: reactivar NO reinicia el reloj del monitoreo.
        expect(monitoreadoDesde).toEqual(hitos[0].fecha);
        for (let i = 1; i < hitos.length; i++) {
            expect(hitos[i].fecha.getTime()).toBeGreaterThanOrEqual(hitos[i - 1].fecha.getTime());
        }
    });

    it("sigue la vida de una cuenta: alta, apagado y encendido, nombrándola", async () => {
        const padre = await crearPadre("cuentas");
        const hijoId = await crearMenor(padre.id);

        const { identificadorId } = await agregarIdentificador(padre.id, hijoId, {
            valor: "sofi_roblox",
        });
        await cambiarEstadoIdentificador(padre.id, identificadorId, false);
        await cambiarEstadoIdentificador(padre.id, identificadorId, true);

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);

        expect(hitos.map((h) => h.tipo)).toEqual([
            "menor_registrado",
            "identificador_asignado",
            "identificador_inactivado",
            "identificador_activado",
        ]);
        // El alta de la cuenta sale UNA vez: viene del `creadoEn`, y el
        // HIJO_UPDATE de "agregado" no debe duplicarla.
        expect(hitos.filter((h) => h.tipo === "identificador_asignado")).toHaveLength(1);
        for (const hito of hitos.slice(1)) {
            expect(hito.identificador).toBe("sofi_roblox");
            expect(hito.descripcion).toContain("sofi_roblox");
        }
    });

    it("una cuenta quitada deja hito atribuido al menor y sin exponer su valor", async () => {
        const padre = await crearPadre("quitar");
        const hijoId = await crearMenor(padre.id);
        const { identificadorId } = await agregarIdentificador(padre.id, hijoId, {
            valor: "sofi_correo@test.local",
        });

        await desvincularIdentificador(padre.id, identificadorId);

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);
        const quitada = hitos.filter((h) => h.tipo === "identificador_inactivado");
        expect(quitada).toHaveLength(1);
        // PII: el valor NO viaja en la auditoría, así que no puede aparecer.
        expect(quitada[0].descripcion).not.toContain("sofi_correo@test.local");
        expect(quitada[0].identificador).toBeUndefined();

        // Y la atadura al menor existe de verdad en el metadato auditado.
        const auditado = await prisma.auditLog.findFirst({
            where: { accion: "HIJO_IDENTIFICADOR_DESVINCULADO", recursoId: identificadorId },
            select: { valorNuevo: true },
        });
        expect(JSON.parse(auditado?.valorNuevo ?? "{}")).toEqual({ hijoId });
    });

    it("no atribuye a este menor la cuenta quitada de OTRO hijo del mismo padre", async () => {
        const padre = await crearPadre("cruce");
        const hijoA = await crearMenor(padre.id, "Ana");
        const hijoB = await crearMenor(padre.id, "Beto");
        const { identificadorId } = await agregarIdentificador(padre.id, hijoB, {
            valor: "beto_roblox",
        });

        await desvincularIdentificador(padre.id, identificadorId);

        const bitacoraA = await bitacoraDelMenor(hijoA, padre.id);
        expect(bitacoraA.hitos.map((h) => h.tipo)).toEqual(["menor_registrado"]);

        const bitacoraB = await bitacoraDelMenor(hijoB, padre.id);
        expect(bitacoraB.hitos.some((h) => h.tipo === "identificador_inactivado")).toBe(true);
    });

    it("corregir los datos de la ficha no ensucia la línea de la protección", async () => {
        const padre = await crearPadre("correccion");
        const hijoId = await crearMenor(padre.id);

        await actualizarHijo(padre.id, hijoId, { nombre: "Sofía Lucía" });

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);
        expect(hitos.map((h) => h.tipo)).toEqual(["menor_registrado"]);
    });

    it("la ficha de otro padre no se lee: 404", async () => {
        const dueno = await crearPadre("dueno");
        const ajeno = await crearPadre("ajeno");
        const hijoId = await crearMenor(dueno.id);

        await expect(bitacoraDelMenor(hijoId, ajeno.id)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("un metadato con JSON roto se omite en vez de tumbar la bitácora", async () => {
        const padre = await crearPadre("json-roto");
        const hijoId = await crearMenor(padre.id);
        await prisma.auditLog.create({
            data: {
                accion: "HIJO_UPDATE",
                tipoRecurso: "Hijo",
                recursoId: hijoId,
                usuarioId: padre.id,
                valorNuevo: "{esto no es json",
                ipAddress: "127.0.0.1",
                userAgent: "test",
            },
        });

        const { hitos } = await bitacoraDelMenor(hijoId, padre.id);
        expect(hitos.map((h) => h.tipo)).toEqual(["menor_registrado"]);
    });
});
