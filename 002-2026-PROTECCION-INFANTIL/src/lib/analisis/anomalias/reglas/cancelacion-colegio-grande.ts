/**
 * SPEC-225 (D-78): CANCELACION_COLEGIO_GRANDE, severidad ALTA.
 * Suscripción cancelada en las últimas 24h cuyo colegio acumula más de
 * `colegio_grande_min_reportes` filas históricas de `Reporte` (solo conteo;
 * NUNCA se lee el texto — la retención purga textos pero nunca filas).
 */
import type { CandidatoAnomalia, ContextoDeteccion } from "../tipos";

export async function detectarCancelacionColegioGrande(
    ctx: ContextoDeteccion
): Promise<CandidatoAnomalia[]> {
    const { repo, parametros, ventanas } = ctx;
    const cancelaciones = await repo.listarCancelacionesRecientes(ventanas.ultimas24h.desde);

    const tenantIds = [
        ...new Set(
            cancelaciones
                .map((c) => c.colegio?.tenantId)
                .filter((t): t is string => typeof t === "string")
        ),
    ];
    const reportesPorTenant = await repo.contarReportesPorTenant(tenantIds);

    const candidatos: CandidatoAnomalia[] = [];
    for (const cancelacion of cancelaciones) {
        const colegio = cancelacion.colegio;
        if (!colegio) continue;
        const reportesHistoricos = reportesPorTenant.get(colegio.tenantId) ?? 0;
        if (reportesHistoricos <= parametros.colegioGrandeMinReportes) continue;
        candidatos.push({
            tipo: "CANCELACION_COLEGIO_GRANDE",
            sujetoTipo: "Colegio",
            sujetoId: colegio.id,
            severidad: "ALTA",
            descripcion: `Un colegio con ${reportesHistoricos} reportes históricos canceló su suscripción en las últimas 24 horas.`,
            datosContexto: {
                colegioId: colegio.id,
                suscripcionId: cancelacion.id,
                canceladaEn: cancelacion.canceladaEn?.toISOString() ?? null,
                reportesHistoricos,
                umbralMinReportes: parametros.colegioGrandeMinReportes,
            },
        });
    }
    return candidatos;
}
