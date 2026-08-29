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

    // SPEC-131 (BL-5): la visibilidad se decide SOLO con reportes APROBADOS
    // (predicado único spec 089/D-08): el spam y OTRO nunca empujan el umbral,
    // y el ratio de autenticados se calcula sobre la misma base aprobada.
    const ratioAutenticados = agregado.reportesAprobados > 0
        ? agregado.autenticadosAprobados / agregado.reportesAprobados
        : 0;

    // SPEC-110: la marca `ocultoPorComiteEn` es la decisión humana del comité al aceptar
    // una apelación. Mientras exista, el identificador no es visible. La levanta SOLO
    // un reporte nuevo (upsert en POST /api/reportes): sin lista blanca permanente.
    const esVisible = !agregado.ocultoPorComiteEn && agregado.reportesAprobados >= umbral && ratioAutenticados >= minRatio;

    await db.identificadorReportado.update({
        where: { id: agregado.id },
        data: { esVisiblePublicamente: esVisible },
    });
}
