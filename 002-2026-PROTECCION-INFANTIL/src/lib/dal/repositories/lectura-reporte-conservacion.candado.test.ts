/**
 * SPEC-701 (I-421) parte 3 · Candado de CONSERVACIÓN (20 años): borrar el Reporte o el
 * EventoExpediente NO borra el rastro de quién leyó el relato. La fila de `LecturaReporte`
 * SOBREVIVE con su `reporteId`/`eventoId` puesto en NULL y su `contenidoId` + `hashContenido`
 * intactos — el rastro es por hash del contenido, no por el vínculo al padre.
 *
 * Control positivo de la migración `spec701_lecturareporte_fk_setnull` (Cascade → SetNull):
 * con la FK en `Cascade` (la conducta vieja), el borrado ARRASTRABA la fila y estas
 * aserciones («la fila sobrevive») quedan ROJAS. Es exactamente lo que I-421 exige evitar:
 * los delitos contra menores no prescriben, el rastro tiene que durar más que el reporte.
 *
 * D-121 de Datos.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { sellarTextoNuevo } from "@/lib/reporte-texto-contenido";

const HASH = "a".repeat(64);

async function plataforma() {
    return prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp" },
    });
}

describe("SPEC-701 · el rastro de lectura SOBREVIVE al borrado del reporte/evento (FK SetNull)", () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("borrar un Reporte deja la LecturaReporte VIVA, con reporteId=null y contenido/hash intactos", async () => {
        const plat = await plataforma();
        const reporte = await crearReporteFixture(prisma, {
            data: {
                identificador: `+57300${Date.now()}`,
                plataformaId: plat.id,
                texto: "relato de prueba SPEC-701",
                fechaIncidente: new Date("2026-09-01T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                estado: "REVISION_MANUAL",
            },
        });
        const fila = await prisma.lecturaReporte.create({
            data: { reporteId: reporte.id, contenidoId: reporte.contenidoId, campo: "texto", tipoActor: "PLATAFORMA", hashContenido: HASH },
        });

        await prisma.reporte.delete({ where: { id: reporte.id } });

        const despues = await prisma.lecturaReporte.findUnique({ where: { id: fila.id } });
        expect(despues, "la fila de lectura sobrevive al borrado del reporte (conservación 20 años)").not.toBeNull();
        expect(despues!.reporteId, "el vínculo al reporte se pone en NULL — no arrastra la fila").toBeNull();
        expect(despues!.contenidoId).toBe(reporte.contenidoId);
        expect(despues!.hashContenido).toBe(HASH);
    });

    it("borrar un EventoExpediente deja la LecturaReporte VIVA, con eventoId=null", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await prisma.expediente.create({
            data: {
                padreUsuarioId: padre.id,
                identificadorReportado: `+57300EXP${Date.now()}`,
                fechaApertura: new Date("2026-09-01T09:00:00Z"),
                estado: "ACTIVO",
                scoreGravedadActual: "AMARILLO",
            },
        });
        // El evento tiene su PROPIO contenido (XOR de dueño, D-117): no comparte el de un reporte.
        const contenido = await prisma.$transaction((tx) =>
            sellarTextoNuevo(tx, { texto: "relato del evento SPEC-701", textoOriginal: "original del evento" }),
        );
        const evento = await prisma.eventoExpediente.create({
            data: { expedienteId: expediente.id, ordenSecuencial: 1, contenidoId: contenido.contenidoId, fechaEvento: new Date("2026-09-01T10:05:00Z") },
        });
        const fila = await prisma.lecturaReporte.create({
            data: { eventoId: evento.id, contenidoId: contenido.contenidoId, campo: "texto", tipoActor: "EXTERNO", hashContenido: HASH },
        });

        await prisma.eventoExpediente.delete({ where: { id: evento.id } });

        const despues = await prisma.lecturaReporte.findUnique({ where: { id: fila.id } });
        expect(despues, "la fila de lectura sobrevive al borrado del evento").not.toBeNull();
        expect(despues!.eventoId, "el vínculo al evento se pone en NULL — no arrastra la fila").toBeNull();
        expect(despues!.contenidoId).toBe(contenido.contenidoId);
    });
});
