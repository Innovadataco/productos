import { prisma } from "@/lib/prisma";
import { anonimizarTexto } from "@/lib/ai/anonimizador";
import { descifrarCampo, resellarCampo } from "@/lib/reporte-texto-contenido";
import type { EstadoReporte } from "@prisma/client";

/**
 * S-C (D-116/D-117): anonimiza el relato re-sellando SOLO el texto de TRABAJO.
 *
 * El original (evidencia) se descifra para alimentar al anonimizador pero NUNCA se re-escribe
 * (`resellarCampo` es de tipo cerrado a "texto"; el original es write-once, política del CEO).
 * El re-sellado y el update de la clasificación van en la MISMA transacción.
 */
export async function anonimizarReporte({
    reporteId,
    contenidoId,
    piiDetectada,
    modeloAnonimizacion,
}: {
    reporteId: string;
    contenidoId: string;
    piiDetectada: string[];
    modeloAnonimizacion: string;
}): Promise<{ estadoFinal: EstadoReporte }> {
    const originalPlano = await descifrarCampo(prisma, contenidoId, "textoOriginal");
    const anonimizacion = await anonimizarTexto(modeloAnonimizacion, originalPlano, piiDetectada);

    await prisma.$transaction(async (tx) => {
        // Solo el texto de TRABAJO pasa a la versión anonimizada; el original queda intacto.
        await resellarCampo(tx, contenidoId, "texto", anonimizacion.textoAnonimizado);
        await tx.clasificacionIA.update({
            where: { reporteId },
            data: { piiDetectada: anonimizacion.piiDetectada },
        });
    });

    return { estadoFinal: "CLASIFICADO" };
}
