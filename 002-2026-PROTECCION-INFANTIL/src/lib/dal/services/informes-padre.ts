/**
 * SPEC-340 (A-68 §4.3) — el historial INMUTABLE de informes del padre.
 *
 * «Ese registro no se puede borrar ni editar — es parte de la evidencia.»
 * La inmutabilidad acá no es cosmética: este servicio expone SOLO registrar y
 * listar. No existe update ni delete en ninguna capa — ni acá, ni en una ruta,
 * ni en el panel del admin. El test lo afirma contra los exports.
 *
 * NO confundir con `InformeConsolidado` (flujo de COMITÉ, SPEC-234/237): aquel
 * arrastra score y estado de aprobación, prohibidos para el padre.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { logAudit } from "../../audit";

export interface InformeRegistrado {
    id: string;
    numeroSecuencial: number;
    codigoVerificacion: string;
    generadoEn: Date;
}

/**
 * Registra una generación de informe. El número secuencial se calcula DENTRO
 * de la transacción y se SERIALIZA por expediente con un advisory-lock de
 * transacción (`pg_advisory_xact_lock`): sin él, dos generaciones simultáneas
 * leían el mismo `max(numeroSecuencial)` y disparaban el unique
 * `(expedienteId, numeroSecuencial)` (I-208 · carrera real cazada por el test
 * "dos generaciones en el mismo minuto no chocan"). El lock se libera solo al
 * cerrar la transacción; mismo patrón que `reporte-repository.ts:320`.
 */
export async function registrarInformePadre(input: {
    expedienteId: string;
    generadoPorId: string;
    pdfHash: string;
    codigoVerificacion: string;
}): Promise<InformeRegistrado> {
    return prisma.$transaction(async (tx) => {
        // Serializar por expediente ANTES de leer el max: dos tx concurrentes
        // sobre el mismo expediente se encolan; sobre expedientes distintos
        // corren en paralelo (hashtext colisiona muy raro y el peor caso es
        // serializar de más, jamás corromper).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`informe-padre:${input.expedienteId}`}))`;

        const ultimo = await tx.informePadre.findFirst({
            where: { expedienteId: input.expedienteId },
            orderBy: { numeroSecuencial: "desc" },
            select: { numeroSecuencial: true },
        });
        const numeroSecuencial = (ultimo?.numeroSecuencial ?? 0) + 1;

        const creado = await tx.informePadre.create({
            data: {
                expedienteId: input.expedienteId,
                numeroSecuencial,
                pdfHash: input.pdfHash,
                codigoVerificacion: input.codigoVerificacion,
                generadoPorId: input.generadoPorId,
            },
            select: { id: true, numeroSecuencial: true, codigoVerificacion: true, generadoEn: true },
        });

        await logAudit({
            accion: "PDF_GENERADO",
            tipoRecurso: "InformePadre",
            recursoId: creado.id,
            usuarioId: input.generadoPorId,
            // Sin PII: número y expediente, nunca contenido.
            valorNuevo: JSON.stringify({ expedienteId: input.expedienteId, numeroSecuencial }),
            tx: tx as Prisma.TransactionClient,
        });

        return creado;
    });
}

/** El historial visible al padre — permanente, del más reciente al primero. */
export async function listarInformesPadre(expedienteId: string): Promise<InformeRegistrado[]> {
    return prisma.informePadre.findMany({
        where: { expedienteId },
        orderBy: { numeroSecuencial: "desc" },
        select: { id: true, numeroSecuencial: true, codigoVerificacion: true, generadoEn: true },
    });
}

/** Verificación pública: ¿existe un informe del padre con este hash? */
export async function buscarInformePadrePorHash(pdfHash: string) {
    return prisma.informePadre.findUnique({
        where: { pdfHash },
        select: { id: true, generadoEn: true, numeroSecuencial: true, expedienteId: true },
    });
}

/** Verificación pública por el CÓDIGO impreso en el pie (16 hex). */
export async function buscarInformePadrePorCodigo(codigo: string) {
    return prisma.informePadre.findFirst({
        where: { codigoVerificacion: codigo },
        select: { id: true, generadoEn: true, numeroSecuencial: true, expedienteId: true },
    });
}
