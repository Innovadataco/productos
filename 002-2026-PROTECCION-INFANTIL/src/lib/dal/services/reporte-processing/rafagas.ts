import { prisma } from "@/lib/prisma";
import { registrarPaso } from "@/lib/expediente/pasos";
import type { Prisma } from "@prisma/client";

/**
 * A-72 · La ráfaga cuenta por ORIGEN, no por la cuenta reportada.
 *
 * El corazón del producto es que VARIAS personas independientes reportando el
 * mismo identificador FORTALECEN el caso. Contar la ráfaga solo por
 * identificador+plataforma marcaba esa corroboración legítima como "ráfaga
 * sospechosa" y la mandaba a REVISION_MANUAL — al revés de lo que debe pasar.
 *
 * Ahora la ráfaga atrapa a UN MISMO ORIGEN spameando la misma cuenta. El origen
 * es el `ipHash`/`fingerprintHash` que `crearFuenteReporte` ya captura en el POST
 * de /api/reportes (hash con sal `ANTI_ABUSO_SALT`, IP truncada /24 — nunca IP
 * cruda) ANTES de encolar el procesamiento; para cuando esta guarda corre, la
 * `FuenteReporte` del reporte ya existe. Se reusa el mismo predicado de origen
 * que `detectarRafagaFuente` (anti-abuso), sin migración nueva.
 *
 * Reportes anónimos por Tor salen como orígenes distintos (IP de salida variable)
 * → se respeta el anonimato y la ráfaga solo cae sobre spam desde un origen fijo.
 * Aceptable y documentado (brief A-72).
 */
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

    // Origen del reporte actual. `crearFuenteReporte` corre antes de encolar, así
    // que la fila ya existe con ipHash y fingerprintHash (ambos no nulos en el
    // camino real). Se agrupa por CUALQUIERA de los dos, igual que detectarRafagaFuente.
    const fuente = await prisma.fuenteReporte.findUnique({
        where: { reporteId },
        select: { ipHash: true, fingerprintHash: true },
    });
    const origenOR: Prisma.ReporteWhereInput["OR"] = [];
    if (fuente?.ipHash) origenOR.push({ fuente: { ipHash: fuente.ipHash } });
    if (fuente?.fingerprintHash) origenOR.push({ fuente: { fingerprintHash: fuente.fingerprintHash } });

    // Sin origen no se puede atribuir la ráfaga a UNA sola fuente: no marcamos.
    // Preferimos no penalizar antes que castigar corroboración legítima (el norte
    // del A-72). En el camino real esto no ocurre; cubre reportes sin FuenteReporte.
    if (origenOR.length === 0) {
        await registrarPaso(reporteId, "guardas", {
            veredicto: "sin_rafaga",
            detalle: { motivo: "origen_desconocido", rafagaN, rafagaHoras },
        });
        return false;
    }

    // Base: mismo identificador + plataforma + MISMO origen. Distinto origen sobre
    // el mismo nick = corroboración, no entra en el conteo.
    const baseOrigen: Prisma.ReporteWhereInput = {
        identificador,
        plataformaId,
        eliminado: false,
        OR: origenOR,
    };

    const historialPrevio = await prisma.reporte.count({
        where: { ...baseOrigen, creadoEn: { lt: inicioVentana } },
    });
    if (historialPrevio > 0) {
        await registrarPaso(reporteId, "guardas", {
            veredicto: "sin_rafaga",
            detalle: { motivo: "historial_previo", historialPrevio, rafagaN, rafagaHoras },
        });
        return false;
    }

    // Reportes del MISMO origen sobre el mismo identificador dentro de la ventana.
    // Se traen los ids (Prisma no filtra por relación en updateMany) para marcarlos.
    const enVentana = await prisma.reporte.findMany({
        where: { ...baseOrigen, creadoEn: { gte: inicioVentana, lte: ahora } },
        select: { id: true },
    });
    if (enVentana.length >= rafagaN) {
        await prisma.reporte.updateMany({
            where: { id: { in: enVentana.map((r) => r.id) } },
            data: { esRafaga: true },
        });
        await registrarPaso(reporteId, "guardas", {
            veredicto: "rafaga_detectada",
            detalle: { reportesEnVentana: enVentana.length, rafagaN, rafagaHoras, porOrigen: true },
        });
        return true;
    }
    await registrarPaso(reporteId, "guardas", {
        veredicto: "sin_rafaga",
        detalle: { reportesEnVentana: enVentana.length, rafagaN, rafagaHoras },
    });
    return false;
}
