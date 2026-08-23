/**
 * SPEC-230 (002-PI-130): tests del ExpedienteRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "./expediente-repository";

async function crearPadre() {
    return crearUsuario("PARENT");
}

async function crearExpediente(repo: ExpedienteRepository, padreId: string, identificador = "+573001234567") {
    return repo.crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: identificador,
        plataformaId: "whatsapp",
    });
}

async function asegurarPlataformaWhatsapp() {
    await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
    });
}

async function idDePlataforma(clave: string) {
    const plataforma = await prisma.plataforma.findUnique({
        where: { clave },
        select: { id: true },
    });
    if (!plataforma) throw new Error(`Plataforma ${clave} no existe`);
    return plataforma.id;
}

describe("ExpedienteRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
        await asegurarPlataformaWhatsapp();
    });

    it("crearExpediente abre expediente en ACTIVO con score VERDE y 0 eventos", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);

        expect(expediente.padreUsuarioId).toBe(padre.id);
        expect(expediente.identificadorReportado).toBe("+573001234567");
        expect(expediente.estado).toBe(EstadoExpediente.ACTIVO);
        expect(expediente.scoreGravedadActual).toBe("VERDE");
        expect(expediente.numEventos).toBe(0);
        expect(expediente.fechaCierre).toBeNull();
    });

    it("agregarEvento crea evento con orden secuencial monotónico", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);

        const e1 = await repo.agregarEvento({ expedienteId: expediente.id, texto: "Evento 1" });
        const e2 = await repo.agregarEvento({ expedienteId: expediente.id, texto: "Evento 2" });
        const e3 = await repo.agregarEvento({ expedienteId: expediente.id, texto: "Evento 3" });

        expect(e1.ordenSecuencial).toBe(1);
        expect(e2.ordenSecuencial).toBe(2);
        expect(e3.ordenSecuencial).toBe(3);

        const actualizado = await repo.obtenerExpedientePorId(expediente.id);
        expect(actualizado?.numEventos).toBe(3);
        expect(actualizado?.eventos.map((e) => e.ordenSecuencial)).toEqual([1, 2, 3]);
    });

    it("agregarEvento actualiza numEventos y ultimoEventoEn", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);
        const fecha = new Date("2026-08-22T10:00:00.000Z");

        await repo.agregarEvento({ expedienteId: expediente.id, texto: "Evento", fechaEvento: fecha });

        const actualizado = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(actualizado?.numEventos).toBe(1);
        expect(actualizado?.ultimoEventoEn?.toISOString()).toBe(fecha.toISOString());
    });

    it("agregarEvento rechaza expediente CERRADO con AppError", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);
        await prisma.expediente.update({
            where: { id: expediente.id },
            data: { estado: EstadoExpediente.CERRADO, fechaCierre: new Date() },
        });

        await expect(
            repo.agregarEvento({ expedienteId: expediente.id, texto: "Nuevo" })
        ).rejects.toMatchObject({
            code: "CONFLICT",
            statusCode: 409,
        });
    });

    it("agregarEvento rechaza texto mayor a 2000 caracteres", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);

        await expect(
            repo.agregarEvento({ expedienteId: expediente.id, texto: "x".repeat(2001) })
        ).rejects.toMatchObject({
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
    });

    it("listarExpedientesDePadre no cruza datos entre padres", async () => {
        const repo = new ExpedienteRepository();
        const padreA = await crearPadre();
        const padreB = await crearPadre();
        await crearExpediente(repo, padreA.id, "+573001111111");
        await crearExpediente(repo, padreB.id, "+573002222222");

        const listaA = await repo.listarExpedientesDePadre(padreA.id);
        expect(listaA.items).toHaveLength(1);
        expect(listaA.items[0].identificadorReportado).toBe("+573001111111");

        const listaB = await repo.listarExpedientesDePadre(padreB.id);
        expect(listaB.items).toHaveLength(1);
        expect(listaB.items[0].identificadorReportado).toBe("+573002222222");
    });

    it("obtenerExpedientePorId retorna null si no pertenece al padre", async () => {
        const repo = new ExpedienteRepository();
        const padreA = await crearPadre();
        const padreB = await crearPadre();
        const expediente = await crearExpediente(repo, padreA.id);

        const paraB = await repo.obtenerExpedientePorId(expediente.id, padreB.id);
        expect(paraB).toBeNull();

        const paraA = await repo.obtenerExpedientePorId(expediente.id, padreA.id);
        expect(paraA).not.toBeNull();
        expect(paraA?.id).toBe(expediente.id);
    });

    it("obtenerExpedientePorId incluye eventos ordenados", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);
        await repo.agregarEvento({ expedienteId: expediente.id, texto: "A" });
        await repo.agregarEvento({ expedienteId: expediente.id, texto: "B" });

        const result = await repo.obtenerExpedientePorId(expediente.id);
        expect(result?.eventos).toHaveLength(2);
        expect(result?.eventos[0].texto).toBe("A");
        expect(result?.eventos[1].texto).toBe("B");
    });

    it("agregarEvento crea un Reporte cuando no se recibe reporteId", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);

        const evento = await repo.agregarEvento({
            expedienteId: expediente.id,
            texto: "Reporte asociado",
        });

        const reporte = await prisma.reporte.findUnique({ where: { id: evento.reporteId ?? "" } });
        const plataformaWhatsappId = await idDePlataforma("whatsapp");
        expect(reporte).not.toBeNull();
        expect(reporte?.identificador).toBe(expediente.identificadorReportado);
        expect(reporte?.plataformaId).toBe(plataformaWhatsappId);
    });

    it("agregarEvento vincula un Reporte existente cuando se recibe reporteId", async () => {
        const repo = new ExpedienteRepository();
        const padre = await crearPadre();
        const expediente = await crearExpediente(repo, padre.id);
        const reporte = await prisma.reporte.create({
            data: {
                identificador: expediente.identificadorReportado,
                plataformaId: await idDePlataforma("whatsapp"),
                texto: "Texto original",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
            },
        });

        const evento = await repo.agregarEvento({
            expedienteId: expediente.id,
            texto: "Evento vinculado",
            reporteId: reporte.id,
        });

        expect(evento.reporteId).toBe(reporte.id);
    });
});
