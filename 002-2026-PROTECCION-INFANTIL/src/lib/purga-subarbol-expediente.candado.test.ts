/**
 * SPEC-615 (I-374) · ENSAYO del borrado del subárbol de Expediente contra la BD REAL.
 *
 * El bug: `InformePadre` (FK RESTRICT → Expediente, sin `onDelete`) no se borraba, y la purga abortó
 * en `expediente.deleteMany` en producción. Un test con MOCKS no ve un orden de FK (CEO): éste
 * SIEMBRA el subárbol COMPLETO —las 5 hijas RESTRICT, incluida InformePadre— en la base y corre
 * `borrarSubarbolExpediente`. Si el helper olvida una hija, la constraint REAL lo tumba ACÁ (rojo en
 * la suite de integración), no en la próxima ventana con el borrado a medias. El ensayo sobre el CLON
 * con datos de producción (carril del CEO) es el complemento autoritativo, no el sustituto.
 *
 * Integración: usa la BD (constraints reales tras migrate deploy).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { sellarTextoNuevo } from "@/lib/reporte-texto-contenido";
import { borrarSubarbolExpediente } from "../../scripts/limpieza/_borrar-expediente";

/** Siembra un Expediente con UNA fila en CADA hija con FK RESTRICT → Expediente. */
async function sembrarSubarbolCompleto(): Promise<string> {
    const padre = await prisma.usuario.create({
        data: { email: `padre-615-${randomUUID()}@example.com`, passwordHash: "x".repeat(60), rol: "PARENT" },
    });
    const exp = await prisma.expediente.create({
        data: { padreUsuarioId: padre.id, identificadorReportado: `ID-615-${randomUUID()}`, fechaApertura: new Date(), estado: "ACTIVO" },
    });
    await prisma.informePadre.create({
        data: {
            expedienteId: exp.id,
            numeroSecuencial: 1,
            pdfHash: `hash-${randomUUID()}`,
            codigoVerificacion: "VC-1",
            generadoPorId: padre.id,
        },
    });
    const informe = await prisma.informeConsolidado.create({
        data: {
            expedienteId: exp.id,
            versionSecuencial: 1,
            scoreValor: 0.5,
            scoreGravedad: "VERDE",
            categoriasDetectadasJson: {},
            resumenTextoGenerado: "resumen de prueba",
        },
    });
    await prisma.aclaracionExpediente.create({
        data: { expedienteId: exp.id, informeConsolidadoId: informe.id, solicitudTexto: "aclaración", estado: "PENDIENTE" },
    });
    await prisma.patronExpediente.create({
        data: {
            expedienteId: exp.id,
            tipoPatron: "ACELERACION",
            severidad: "ALTA",
            nivelConfianza: 0.9,
            descripcionTexto: "patrón de prueba",
            datosContextoJson: {},
            detectadoEn: new Date(),
        },
    });
    const { contenidoId } = await prisma.$transaction((tx) => sellarTextoNuevo(tx, { texto: "evento de prueba" }));
    await prisma.eventoExpediente.create({
        data: { expedienteId: exp.id, ordenSecuencial: 1, fechaEvento: new Date(), contenidoId },
    });
    return exp.id;
}

describe("SPEC-615 · borrarSubarbolExpediente contra BD real (I-374)", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.REPORTE_TEXTO_KEY_V1 = randomBytes(32).toString("base64");
        process.env.REPORTE_TEXTO_KEY_ACTIVA = "1";
    });

    it("borra el subárbol COMPLETO (5 hijas RESTRICT + expediente) sin violar ninguna FK", async () => {
        const expId = await sembrarSubarbolCompleto();
        // Precondición: la hija que faltaba (InformePadre) existe → sin el fix, el DROP aborta.
        expect(await prisma.informePadre.count({ where: { expedienteId: expId } })).toBe(1);

        // La operación exacta que abortó en producción — ahora completa sin excepción.
        await expect(prisma.$transaction((tx) => borrarSubarbolExpediente(tx, [expId]))).resolves.toBeUndefined();

        // Post: expediente y TODAS las hijas en 0.
        expect(await prisma.expediente.count({ where: { id: expId } })).toBe(0);
        expect(await prisma.informePadre.count({ where: { expedienteId: expId } })).toBe(0);
        expect(await prisma.aclaracionExpediente.count({ where: { expedienteId: expId } })).toBe(0);
        expect(await prisma.informeConsolidado.count({ where: { expedienteId: expId } })).toBe(0);
        expect(await prisma.patronExpediente.count({ where: { expedienteId: expId } })).toBe(0);
        expect(await prisma.eventoExpediente.count({ where: { expedienteId: expId } })).toBe(0);
    });
});
