import { prisma } from "./prisma";

export interface GuardarReintentoParams {
    reporteId: string;
    intento: number;
    exitoso: boolean;
    error?: string | null;
}

export async function guardarReintento(params: GuardarReintentoParams) {
    const existente = await prisma.reintentoReporte.findFirst({
        where: { reporteId: params.reporteId, intento: params.intento },
        orderBy: { creadoEn: "desc" },
        select: { id: true },
    });
    if (existente) {
        return prisma.reintentoReporte.update({
            where: { id: existente.id },
            data: { exitoso: params.exitoso, error: params.error ?? null },
        });
    }
    return prisma.reintentoReporte.create({
        data: {
            reporteId: params.reporteId,
            intento: params.intento,
            exitoso: params.exitoso,
            error: params.error ?? null,
        },
    });
}

export async function contarReintentos(reporteId: string) {
    return prisma.reintentoReporte.count({ where: { reporteId } });
}

export async function obtenerReintentos(reporteId: string) {
    return prisma.reintentoReporte.findMany({
        where: { reporteId },
        orderBy: { intento: "asc" },
    });
}
