/**
 * SPEC-053 (FR-004, US1): fallback del worker dentro del DAL.
 * Lógica movida desde `api/reportes/fallback/route.ts`: cuando se agotan los
 * reintentos, el reporte pasa a REVISION_MANUAL con su transición, en UNA
 * unidad de trabajo (D2). La asignación de operador queda en la ruta
 * (servicio de dominio de operadores, fire-and-forget).
 */
import { withUnitOfWork } from "../../unit-of-work";
import { ReporteRepository } from "../../repositories/reporte";
import { TransicionReporteRepository } from "../../repositories/transicion-reporte";

export type ResultadoFallback =
    | { ok: true; yaEnRevision: boolean }
    | { ok: false; tipo: "no_encontrado" };

export async function registrarFallbackWorker(reporteId: string, errorCode: string): Promise<ResultadoFallback> {
    const reportes = new ReporteRepository();
    const reporte = await reportes.findByIdBasico(reporteId);

    if (!reporte) {
        return { ok: false, tipo: "no_encontrado" };
    }

    if (reporte.estado === "REVISION_MANUAL") {
        return { ok: true, yaEnRevision: true };
    }

    const mensajeGenerico = "Reintentos agotados procesando el reporte";

    await withUnitOfWork(async (tx) => {
        await new TransicionReporteRepository(tx).registrar({
            reporteId,
            estadoAnterior: reporte.estado,
            estadoNuevo: "REVISION_MANUAL",
            responsableTipo: "WORKER",
            motivo: mensajeGenerico,
            metadatos: { errorCode },
        });
        await new ReporteRepository(tx).actualizarEstado(reporteId, {
            estado: "REVISION_MANUAL",
            processingError: `${mensajeGenerico} (código: ${errorCode})`,
        });
    });

    return { ok: true, yaEnRevision: false };
}
