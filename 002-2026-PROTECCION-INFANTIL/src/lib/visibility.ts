import { prisma } from "./prisma";
import { getParametroSistema } from "./parametros";
import type { Prisma } from "@prisma/client";

export async function actualizarVisibilidadPublica(
    identificador: string,
    plataformaId: string,
    tx?: Prisma.TransactionClient
) {
    const db = tx ?? prisma;
    const paramUmbral = await getParametroSistema("visibility.report_threshold", db);
    const paramRatio = await getParametroSistema("visibility.min_authenticated_ratio", db);

    const umbral = parseInt(paramUmbral?.valor || "3", 10);
    const minRatio = parseFloat(paramRatio?.valor || "0.5");

    const agregado = await db.identificadorReportado.findUnique({
        where: { identificador_plataformaId: { identificador, plataformaId } },
    });

    if (!agregado) return;

    const ratioAutenticados = agregado.totalReportes > 0
        ? agregado.reportesAutenticados / agregado.totalReportes
        : 0;

    const esVisible = agregado.totalReportes >= umbral && ratioAutenticados >= minRatio;

    await db.identificadorReportado.update({
        where: { id: agregado.id },
        data: { esVisiblePublicamente: esVisible },
    });
}
