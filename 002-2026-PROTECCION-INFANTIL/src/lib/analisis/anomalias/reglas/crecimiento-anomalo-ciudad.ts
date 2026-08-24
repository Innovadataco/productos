/**
 * SPEC-225 (plan §2.6): CRECIMIENTO_ANOMALO_CIUDAD, severidad BAJA.
 * Altas de suscripciones (createdAt) de titular colegio agrupadas por
 * `Colegio.ciudadId`, semana calendario Bogotá actual vs anterior. Dispara si
 * la variación supera `crecimiento_pct_umbral`% con base mínima en la semana
 * de referencia. Las altas de titular PADRE no tienen ciudad en v1: se
 * excluyen (research §2.3).
 */
import type { CandidatoAnomalia, ContextoDeteccion } from "../tipos";
import { evaluarComparativaSemanal } from "../comparativas";

export async function detectarCrecimientoAnomaloCiudad(
    ctx: ContextoDeteccion
): Promise<CandidatoAnomalia[]> {
    const { repo, parametros, ventanas } = ctx;
    const [altasActual, altasPrevia] = await Promise.all([
        repo.listarAltasPorSemana(ventanas.semanaActual.desde, ventanas.semanaActual.hasta),
        repo.listarAltasPorSemana(ventanas.semanaAnterior.desde, ventanas.semanaAnterior.hasta),
    ]);

    const porCiudad = new Map<string, { nombre: string; actual: number; anterior: number }>();
    const acumular = (altas: typeof altasActual, campo: "actual" | "anterior") => {
        for (const alta of altas) {
            if (!alta.colegio) continue; // titular PADRE: sin ciudad en v1
            const entrada = porCiudad.get(alta.colegio.ciudadId) ?? {
                nombre: alta.colegio.ciudad.nombre,
                actual: 0,
                anterior: 0,
            };
            entrada[campo] += 1;
            porCiudad.set(alta.colegio.ciudadId, entrada);
        }
    };
    acumular(altasActual, "actual");
    acumular(altasPrevia, "anterior");

    const candidatos: CandidatoAnomalia[] = [];
    for (const [ciudadId, conteos] of porCiudad) {
        const r = evaluarComparativaSemanal(
            conteos.actual,
            conteos.anterior,
            parametros.crecimientoPctUmbral,
            parametros.baseMinimaComparacion,
            "CRECIMIENTO"
        );
        if (!r.evaluable || !r.dispara) continue;
        candidatos.push({
            tipo: "CRECIMIENTO_ANOMALO_CIUDAD",
            sujetoTipo: "Ciudad",
            sujetoId: ciudadId,
            severidad: "BAJA",
            descripcion: `Las altas de suscripciones en ${conteos.nombre} crecieron ${r.variacionPct}% respecto a la semana anterior.`,
            datosContexto: {
                ciudadId,
                ciudad: conteos.nombre,
                altasSemanaActual: conteos.actual,
                altasSemanaAnterior: conteos.anterior,
                variacionPct: r.variacionPct,
                umbralPct: parametros.crecimientoPctUmbral,
                ventanaInicio: ventanas.semanaActual.claveInicio,
                ventanaFin: ventanas.semanaActual.claveFin,
            },
        });
    }
    return candidatos;
}
