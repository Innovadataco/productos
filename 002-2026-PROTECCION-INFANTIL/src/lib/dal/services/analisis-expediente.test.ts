/**
 * SPEC-341 · guardas del DAL del análisis IA capa 2.
 *
 * Cubre:
 *  · FR-008-bis · guard runtime de prioridad < clasificación (SC-008).
 *  · FR-016 · inmutabilidad DAL (no hay updater ni deleter público).
 *  · FR-002 · leerVigente devuelve null cuando no hay publicado.
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as servicio from "./analisis-expediente";
import { sendAnalisisExpediente } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";

async function setPrioridad(valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.analisis.prioridad" },
        update: { valor },
        create: {
            clave: "padre.analisis.prioridad",
            valor,
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
        },
    });
}

async function crearExpediente(padreId: string) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `@t-${Date.now()}`,
            origenCreacion: "PADRE",
            estado: "ACTIVO",
            fechaApertura: new Date(),
        },
    });
}

describe("SPEC-341 · sendAnalisisExpediente · guard runtime SC-008 (FR-008-bis)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("aborta si prioridad >= 10 (rompería la garantía)", async () => {
        await setPrioridad("10");
        await expect(
            sendAnalisisExpediente({
                expedienteId: "cualquier",
                hashCadena: "h".repeat(64),
                alcance: "PADRE_COMPLETO",
                disparador: "APERTURA",
                solicitadoEn: new Date().toISOString(),
            })
        ).rejects.toThrow(/SC-008/);
    });

    it("aborta si alguien sube la prioridad a 42 por error", async () => {
        await setPrioridad("42");
        await expect(
            sendAnalisisExpediente({
                expedienteId: "cualquier",
                hashCadena: "h".repeat(64),
                alcance: "PADRE_COMPLETO",
                disparador: "APERTURA",
                solicitadoEn: new Date().toISOString(),
            })
        ).rejects.toThrow(/SC-008/);
    });
});

describe("SPEC-341 · DAL analisis-expediente · inmutabilidad (FR-016)", () => {
    it("no expone ninguna función de mutación (update/borrar/editar/eliminar/marcar)", () => {
        const exports = Object.keys(servicio);
        const mutadores = exports.filter((e) => /^(actualizar|borrar|editar|eliminar|update|delete|marcar)/i.test(e));
        expect(mutadores, "el DAL del análisis no puede exponer vías de mutación pública").toEqual([]);
    });
});

describe("SPEC-341 · leerVigente", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve null cuando el expediente no tiene análisis publicado", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);
        const v = await servicio.leerVigente(exp.id, padre.id);
        expect(v).toBeNull();
    });

    it("lanza 404 si el expediente no pertenece al usuario", async () => {
        const padreA = await crearUsuario("PARENT");
        const padreB = await crearUsuario("PARENT");
        const expB = await crearExpediente(padreB.id);
        await expect(servicio.leerVigente(expB.id, padreA.id)).rejects.toThrow();
    });
});
