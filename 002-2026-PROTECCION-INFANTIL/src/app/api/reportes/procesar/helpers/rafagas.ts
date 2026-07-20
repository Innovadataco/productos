import { prisma } from "@/lib/prisma";

export async function detectarRafaga({
    identificador,
    plataformaId,
    rafagaN,
    rafagaHoras,
}: {
    identificador: string;
    plataformaId: string;
    rafagaN: number;
    rafagaHoras: number;
}): Promise<boolean> {
    const ahora = new Date();
    const inicioVentana = new Date(ahora.getTime() - rafagaHoras * 60 * 60 * 1000);
    const historialPrevio = await prisma.reporte.count({
        where: {
            identificador,
            plataformaId,
            eliminado: false,
            creadoEn: { lt: inicioVentana },
        },
    });
    if (historialPrevio > 0) return false;

    const reportesEnVentana = await prisma.reporte.count({
        where: {
            identificador,
            plataformaId,
            eliminado: false,
            creadoEn: { gte: inicioVentana, lte: ahora },
        },
    });
    if (reportesEnVentana >= rafagaN) {
        await prisma.reporte.updateMany({
            where: {
                identificador,
                plataformaId,
                eliminado: false,
                creadoEn: { gte: inicioVentana, lte: ahora },
            },
            data: { esRafaga: true },
        });
        return true;
    }
    return false;
}
