import { logAudit } from "@/lib/audit";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { getParametroSistemaValor } from "@/lib/parametros";
import { asignarOperadorAReporte } from "./asignador";

type ResumenReconciliacion = {
    encontrados: number;
    asignados: number;
    fallidos: number;
    detallesFallo: Array<{ reporteId: string; razon: string }>;
    deshabilitado?: boolean;
};

/**
 * SPEC-182 (I-60): busca reportes en REVISION_MANUAL sin operador asignado e intenta
 * asignarles un operador activo. Nunca modifica el asignador; solo orquesta reintentos.
 */
export async function reconciliarHuerfanos(): Promise<ResumenReconciliacion> {
    const enabledRaw = await getParametroSistemaValor("operadores.reconciliacion_enabled");
    const enabled = enabledRaw === null || enabledRaw === "true" || enabledRaw === "1";
    if (!enabled) {
        return { encontrados: 0, asignados: 0, fallidos: 0, detallesFallo: [], deshabilitado: true };
    }

    const reportesRepo = new ReporteRepository();
    const huerfanos = await reportesRepo.findIdsWhere({
        estado: "REVISION_MANUAL",
        operadorId: null,
        eliminado: false,
    });

    const resumen: ResumenReconciliacion = {
        encontrados: huerfanos.length,
        asignados: 0,
        fallidos: 0,
        detallesFallo: [],
    };

    for (const { id: reporteId } of huerfanos) {
        try {
            const resultado = await asignarOperadorAReporte(reporteId);
            if (resultado.asignado) {
                resumen.asignados += 1;
            } else {
                resumen.fallidos += 1;
                resumen.detallesFallo.push({ reporteId, razon: resultado.razon });
            }
        } catch (err) {
            const razon = err instanceof Error ? err.message : "Error desconocido";
            resumen.fallidos += 1;
            resumen.detallesFallo.push({ reporteId, razon });
        }
    }

    if (resumen.asignados > 0) {
        await logAudit({
            accion: "RECONCILIACION_HUERFANOS",
            tipoRecurso: "Reporte",
            valorNuevo: JSON.stringify({
                encontrados: resumen.encontrados,
                asignados: resumen.asignados,
                fallidos: resumen.fallidos,
            }),
        });
    }

    return resumen;
}
