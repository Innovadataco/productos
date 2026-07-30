import { prisma } from "@/lib/prisma";
import { anonimizarTexto } from "@/lib/ai/anonimizador";
import { encryptParameter, isEncryptedValue, decryptParameter } from "@/lib/param-encryption";
import type { EstadoReporte } from "@prisma/client";

export async function anonimizarReporte({
    reporteId,
    textoActual,
    textoOriginalCifrado,
    piiDetectada,
    modeloAnonimizacion,
}: {
    reporteId: string;
    textoActual: string;
    textoOriginalCifrado: string | null;
    piiDetectada: string[];
    modeloAnonimizacion: string;
}): Promise<{ estadoFinal: EstadoReporte }> {
    const originalPlano = obtenerTextoOriginalPlano(textoOriginalCifrado, textoActual);
    const anonimizacion = await anonimizarTexto(modeloAnonimizacion, originalPlano, piiDetectada);

    let textoOriginalCifradoNuevo: string;
    try {
        textoOriginalCifradoNuevo = encryptParameter(originalPlano);
    } catch (err) {
        console.error("[PROCESAR] Error cifrando texto original tras anonimización:", err);
        throw new Error("Error de seguridad persistiendo el original anonimizado");
    }

    await prisma.reporte.update({
        where: { id: reporteId },
        data: {
            textoOriginal: textoOriginalCifradoNuevo,
            texto: anonimizacion.textoAnonimizado,
        },
    });

    await prisma.clasificacionIA.update({
        where: { reporteId },
        data: { piiDetectada: anonimizacion.piiDetectada },
    });

    return { estadoFinal: "CLASIFICADO" };
}

function obtenerTextoOriginalPlano(textoOriginalCifrado: string | null, textoActual: string): string {
    if (textoOriginalCifrado && isEncryptedValue(textoOriginalCifrado)) {
        return decryptParameter(textoOriginalCifrado);
    }
    return textoOriginalCifrado ?? textoActual;
}
