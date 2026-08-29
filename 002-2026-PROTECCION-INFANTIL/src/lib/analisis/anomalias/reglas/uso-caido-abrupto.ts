/**
 * SPEC-225 (plan §2.6): USO_CAIDO_ABRUPTO, severidad MEDIA.
 * Sesiones activas (`SesionLog`) por tenant, semana calendario Bogotá actual
 * vs anterior. Dispara si la caída supera `uso_caido_pct_umbral`% con base
 * mínima en la semana de referencia. El sujeto es el colegio dueño del
 * tenant (H-5: `Colegio.tenantId` → `Tenant`).
 */
import type { CandidatoAnomalia, ContextoDeteccion } from "../tipos";
import { evaluarComparativaSemanal } from "../comparativas";

export async function detectarUsoCaidoAbrupto(
    ctx: ContextoDeteccion
): Promise<CandidatoAnomalia[]> {
    const { repo, parametros, ventanas } = ctx;
    const [actual, previa] = await Promise.all([
        repo.contarSesionesPorTenant(ventanas.semanaActual.desde, ventanas.semanaActual.hasta),
        repo.contarSesionesPorTenant(ventanas.semanaAnterior.desde, ventanas.semanaAnterior.hasta),
    ]);

    const conteoActual = new Map(actual.map((f) => [f.tenantId, f.total]));
    const conteoPrevia = new Map(previa.map((f) => [f.tenantId, f.total]));

    // Solo se evalúan tenants con actividad en alguna de las dos semanas.
    const tenantIds = [...new Set([...conteoActual.keys(), ...conteoPrevia.keys()])];
    if (tenantIds.length === 0) return [];

    const colegios = await repo.listarColegiosPorTenant(tenantIds);
    const colegioPorTenant = new Map(colegios.map((c) => [c.tenantId, c]));

    const candidatos: CandidatoAnomalia[] = [];
    for (const tenantId of tenantIds) {
        const colegio = colegioPorTenant.get(tenantId);
        if (!colegio) continue; // tenant sin colegio asociado: no es sujeto de esta regla
        const r = evaluarComparativaSemanal(
            conteoActual.get(tenantId) ?? 0,
            conteoPrevia.get(tenantId) ?? 0,
            parametros.usoCaidoPctUmbral,
            parametros.baseMinimaComparacion,
            "CAIDA"
        );
        if (!r.evaluable || !r.dispara) continue;
        candidatos.push({
            tipo: "USO_CAIDO_ABRUPTO",
            sujetoTipo: "Colegio",
            sujetoId: colegio.id,
            severidad: "MEDIA",
            descripcion: `Las sesiones activas del colegio cayeron ${Math.abs(r.variacionPct ?? 0)}% respecto a la semana anterior.`,
            datosContexto: {
                colegioId: colegio.id,
                tenantId,
                sesionesSemanaActual: conteoActual.get(tenantId) ?? 0,
                sesionesSemanaAnterior: conteoPrevia.get(tenantId) ?? 0,
                variacionPct: r.variacionPct,
                umbralPct: parametros.usoCaidoPctUmbral,
                ventanaInicio: ventanas.semanaActual.claveInicio,
                ventanaFin: ventanas.semanaActual.claveFin,
            },
        });
    }
    return candidatos;
}
