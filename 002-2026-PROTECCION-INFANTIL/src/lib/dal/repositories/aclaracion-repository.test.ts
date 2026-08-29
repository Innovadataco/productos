/**
 * SPEC-238 (002-PI-mega-cola): tests de integración del AclaracionRepository
 * (CRUD, restricción única por expediente, barrido del worker). T006.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AclaracionRepository, ESTADO_ACLARACION } from "./aclaracion-repository";

async function crearExpedienteEInforme(padreId: string, estado: EstadoExpediente = EstadoExpediente.EN_APROBACION_PADRE) {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300${Math.floor(Math.random() * 10000000)}`,
            fechaApertura: new Date(),
            estado,
            numEventos: 3,
        },
    });
    const informe = await prisma.informeConsolidado.create({
        data: {
            expedienteId: expediente.id,
            versionSecuencial: 1,
            scoreValor: 10,
            scoreGravedad: "VERDE",
            categoriasDetectadasJson: { CONTACTO_INSISTENTE: 3 },
            resumenTextoGenerado: "Resumen consolidado de prueba",
            estadoAprobacion: "APROBADO",
        },
    });
    return { expediente, informe };
}

describe("AclaracionRepository (SPEC-238)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("crear inserta una aclaración PENDIENTE y findByExpedienteId la recupera", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente, informe } = await crearExpedienteEInforme(padre.id);
        const repo = new AclaracionRepository();

        const creada = await repo.crear({
            expedienteId: expediente.id,
            informeConsolidadoId: informe.id,
            solicitudTexto: "No entiendo la conclusión del informe.",
        });

        expect(creada.estado).toBe(ESTADO_ACLARACION.PENDIENTE);
        expect(creada.solicitadaEn).toBeInstanceOf(Date);

        const recuperada = await repo.findByExpedienteId(expediente.id);
        expect(recuperada?.id).toBe(creada.id);

        const porId = await repo.findById(creada.id);
        expect(porId?.expediente.id).toBe(expediente.id);
        expect(porId?.expediente.padreUsuarioId).toBe(padre.id);
    });

    it("la restricción única por expediente convierte la segunda creación en 409", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente, informe } = await crearExpedienteEInforme(padre.id);
        const repo = new AclaracionRepository();

        await repo.crear({
            expedienteId: expediente.id,
            informeConsolidadoId: informe.id,
            solicitudTexto: "Primera aclaración",
        });

        await expect(
            repo.crear({
                expedienteId: expediente.id,
                informeConsolidadoId: informe.id,
                solicitudTexto: "Segunda aclaración (debe fallar)",
            })
        ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

        const total = await prisma.aclaracionExpediente.count({ where: { expedienteId: expediente.id } });
        expect(total).toBe(1);
    });

    it("responder actualiza estado, texto y autor; re-responder devuelve 409", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const { expediente, informe } = await crearExpedienteEInforme(padre.id);
        const repo = new AclaracionRepository();
        const creada = await repo.crear({
            expedienteId: expediente.id,
            informeConsolidadoId: informe.id,
            solicitudTexto: "Duda del padre",
        });

        const respondida = await repo.responder(creada.id, comite.id, "Respuesta del comité");
        expect(respondida.estado).toBe(ESTADO_ACLARACION.RESPONDIDA);
        expect(respondida.respondidaPor).toBe(comite.id);
        expect(respondida.respondidaEn).toBeInstanceOf(Date);

        await expect(repo.responder(creada.id, comite.id, "Otra respuesta")).rejects.toMatchObject({
            code: "CONFLICT",
            statusCode: 409,
        });
    });

    it("marcarCerradaForzosamente es idempotente", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente, informe } = await crearExpedienteEInforme(padre.id);
        const repo = new AclaracionRepository();
        const creada = await repo.crear({
            expedienteId: expediente.id,
            informeConsolidadoId: informe.id,
            solicitudTexto: "Duda",
        });

        expect(await repo.marcarCerradaForzosamente(creada.id)).toBe(true);
        expect(await repo.marcarCerradaForzosamente(creada.id)).toBe(false);

        const final = await repo.findById(creada.id);
        expect(final?.estado).toBe(ESTADO_ACLARACION.CERRADA_FORZOSAMENTE);
    });

    it("contarPorExpedienteYEstado y listarPendientesVencidas alimentan guards y worker", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente, informe } = await crearExpedienteEInforme(padre.id, EstadoExpediente.EN_ACLARACION);
        const repo = new AclaracionRepository();
        const creada = await repo.crear({
            expedienteId: expediente.id,
            informeConsolidadoId: informe.id,
            solicitudTexto: "Duda",
        });
        // Simula una solicitud de hace 72h (vencida con SLA 48h).
        const hace72h = new Date(Date.now() - 72 * 3_600_000);
        await prisma.aclaracionExpediente.update({
            where: { id: creada.id },
            data: { solicitadaEn: hace72h },
        });

        expect(await repo.contarPorExpedienteYEstado(expediente.id, "PENDIENTE")).toBe(1);
        expect(await repo.contarPorExpedienteYEstado(expediente.id, "RESPONDIDA")).toBe(0);

        const limite48h = new Date(Date.now() - 48 * 3_600_000);
        const vencidas = await repo.listarPendientesVencidas(limite48h);
        expect(vencidas.map((a) => a.id)).toContain(creada.id);

        const limite96h = new Date(Date.now() - 96 * 3_600_000);
        const noVencidas = await repo.listarPendientesVencidas(limite96h);
        expect(noVencidas.map((a) => a.id)).not.toContain(creada.id);
    });
});
