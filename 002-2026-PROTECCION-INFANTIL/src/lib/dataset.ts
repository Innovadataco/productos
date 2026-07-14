import { prisma } from "@/lib/prisma";
import type { CategoriaConducta } from "@prisma/client";

/**
 * Registra un par (texto, clasificación) en el dataset de entrenamiento.
 * Reglas duras:
 * - Usa SOLO reporte.texto (anonimizado), NUNCA textoOriginal.
 * - NUNCA registra si el reporte está en estado REQUIERE_ANONIMIZACION.
 * - Usa Prisma ORM, no raw SQL.
 */
export async function registrarDatasetEntrenamiento(params: {
    reporteId: string;
    categoriaCorrecta: CategoriaConducta;
    fuente: string;
    correccionId?: string;
}): Promise<void> {
    const { reporteId, categoriaCorrecta, fuente, correccionId } = params;

    const reporte = await prisma.reporte.findUnique({
        where: { id: reporteId },
        select: { texto: true, estado: true },
    });

    if (!reporte) {
        throw new Error(`Reporte ${reporteId} no encontrado`);
    }

    if (reporte.estado === "REQUIERE_ANONIMIZACION") {
        throw new Error(
            `No se puede registrar en dataset un reporte en estado REQUIERE_ANONIMIZACION (${reporteId})`
        );
    }

    // Garantía: si existe textoOriginal, el texto actual ya fue anonimizado
    // y es seguro usarlo. Si no existe textoOriginal, texto es el original.
    // En ambos casos, texto es la versión que debe alimentar el dataset.
    await prisma.datasetEntrenamiento.create({
        data: {
            texto: reporte.texto,
            clasificacionCorrecta: categoriaCorrecta,
            fuente,
            correccionId: correccionId || null,
        },
    });
}