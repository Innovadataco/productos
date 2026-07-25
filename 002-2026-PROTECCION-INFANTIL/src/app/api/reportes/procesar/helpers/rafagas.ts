import { prisma } from "@/lib/prisma";
import { registrarPaso } from "@/lib/expediente/pasos";

export async function detectarRafaga({
    reporteId,
    identificador,
    plataformaId,
    rafagaN,
    rafagaHoras,
}: {
    reporteId: string;
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
    if (historialPrevio > 0) {
        await registrarPaso(reporteId, "guardas", {
            veredicto: "sin_rafaga",
            detalle: { motivo: "historial_previo", historialPrevio, rafagaN, rafagaHoras },
        });
        return false;
    }

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
        await registrarPaso(reporteId, "guardas", {
            veredicto: "rafaga_detectada",
            detalle: { reportesEnVentana, rafagaN, rafagaHoras },
        });
        return true;
    }
    await registrarPaso(reporteId, "guardas", {
        veredicto: "sin_rafaga",
        detalle: { reportesEnVentana, rafagaN, rafagaHoras },
    });
    return false;
}
