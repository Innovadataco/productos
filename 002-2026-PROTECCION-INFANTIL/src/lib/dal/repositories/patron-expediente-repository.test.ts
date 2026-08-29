/**
 * SPEC-234 (002-PI-134): tests del PatronExpedienteRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "./expediente-repository";
import { PatronExpedienteRepository } from "./patron-expediente-repository";

async function crearPadre() {
    return crearUsuario("PARENT");
}

async function crearExpediente(padreId: string) {
    await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
    });
    return new ExpedienteRepository().crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: "+573001234567",
        plataformaId: "whatsapp",
    });
}

describe("PatronExpedienteRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("guardarPatrones inserta filas por expediente", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new PatronExpedienteRepository();

        const patrones = await repo.guardarPatrones(expediente.id, [
            {
                tipoPatron: "ACELERACION",
                severidad: "ALTA",
                nivelConfianza: 0.9,
                descripcionTexto: "Aceleración detectada",
                datosContextoJson: { ratio: 2.5 },
                detectadoEn: new Date(),
            },
        ]);

        expect(patrones).toHaveLength(1);
        expect(patrones[0].tipoPatron).toBe("ACELERACION");
    });

    it("listarPorExpediente no cruza entre expedientes", async () => {
        const padre = await crearPadre();
        const e1 = await crearExpediente(padre.id);
        const e2 = await crearExpediente(padre.id);
        const repo = new PatronExpedienteRepository();

        await repo.guardarPatrones(e1.id, [
            {
                tipoPatron: "MULTIPLATAFORMA",
                severidad: "MEDIA",
                nivelConfianza: 0.7,
                descripcionTexto: "Multiplataforma",
                datosContextoJson: { plataformas: 2 },
                detectadoEn: new Date(),
            },
        ]);

        const deE2 = await repo.listarPorExpediente(e2.id);
        expect(deE2).toHaveLength(0);

        const deE1 = await repo.listarPorExpediente(e1.id);
        expect(deE1).toHaveLength(1);
    });

    it("eliminarPorExpediente borra solo los del expediente", async () => {
        const padre = await crearPadre();
        const e1 = await crearExpediente(padre.id);
        const e2 = await crearExpediente(padre.id);
        const repo = new PatronExpedienteRepository();

        await repo.guardarPatrones(e1.id, [
            {
                tipoPatron: "ACELERACION",
                severidad: "BAJA",
                nivelConfianza: 0.5,
                descripcionTexto: "A",
                datosContextoJson: {},
                detectadoEn: new Date(),
            },
        ]);
        await repo.guardarPatrones(e2.id, [
            {
                tipoPatron: "PROGRESION",
                severidad: "BAJA",
                nivelConfianza: 0.5,
                descripcionTexto: "B",
                datosContextoJson: {},
                detectadoEn: new Date(),
            },
        ]);

        await repo.eliminarPorExpediente(e1.id);
        expect((await repo.listarPorExpediente(e1.id))).toHaveLength(0);
        expect((await repo.listarPorExpediente(e2.id))).toHaveLength(1);
    });
});
