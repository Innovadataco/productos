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
import { borrarSubarbolExpediente, HIJAS_RESTRICT_EXPEDIENTE } from "../../scripts/limpieza/_borrar-expediente";

/**
 * Delegate de Prisma para un modelo de `HIJAS_RESTRICT_EXPEDIENTE`. El cliente nombra los delegates en
 * camelCase del modelo (independiente de `@@map`): `InformePadre` → `prisma.informePadre`. Así el
 * candado ITERA la constante (membresía) para afirmar la CONDUCTA real (la fila se fue), por ENTRADA.
 */
function contarHija(modelo: string, expedienteId: string): Promise<number> {
    const delegate = (prisma as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[
        modelo.charAt(0).toLowerCase() + modelo.slice(1)
    ];
    return delegate.count({ where: { expedienteId } });
}

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

    it("borra el subárbol COMPLETO, ITERANDO la constante y afirmando por ENTRADA (no en agregado)", async () => {
        const expId = await sembrarSubarbolCompleto();

        // PRE · la semilla cubre CADA entrada de HIJAS_RESTRICT_EXPEDIENTE. Si alguien agrega una hija
        // a la constante y NO la siembra acá, esto es rojo NOMBRÁNDOLA — el rehearsal no puede probar
        // el borrado de algo que no sembró (la lección de la madrugada: cero nodos ≠ árbol limpio).
        for (const hija of HIJAS_RESTRICT_EXPEDIENTE) {
            expect(await contarHija(hija, expId), `la semilla debe incluir ${hija}`).toBe(1);
        }

        // La operación exacta que abortó en producción — ahora completa sin excepción. Si el helper
        // olvida un `deleteMany`, la FK RESTRICT real tumba `expediente.deleteMany` acá y esto rechaza,
        // nombrando la constraint (p.ej. `InformePadre_expedienteId_fkey`).
        await expect(prisma.$transaction((tx) => borrarSubarbolExpediente(tx, [expId]))).resolves.toBeUndefined();

        // POST · afirmación POR ENTRADA (no un conteo global que taparía una hija sin borrar): cada
        // entrada de la constante quedó en 0, nombrando cuál si sobrevive.
        for (const hija of HIJAS_RESTRICT_EXPEDIENTE) {
            expect(await contarHija(hija, expId), `${hija} debió quedar en 0 tras la purga`).toBe(0);
        }
        expect(await prisma.expediente.count({ where: { id: expId } }), "el expediente quedó en 0").toBe(0);
    });
});
