/**
 * SPEC-225 (D-78): CAIDA_RECAUDO_CIUDAD, severidad ALTA.
 * Recaudo autorizado (Σ `Pago.montoNetoUSD`, comparable multi-moneda) por
 * ciudad, semana calendario Bogotá actual vs anterior. Dispara si la caída
 * supera `caida_recaudo_pct_umbral`% con base mínima (en USD) en la semana
 * de referencia. Pagos de titulares PADRE (sin colegio) no tienen ciudad en
 * v1: se excluyen (research §2.3).
 */
import type { CandidatoAnomalia, ContextoDeteccion } from "../tipos";
import { evaluarComparativaSemanal } from "../comparativas";

function redondear2(valor: number): number {
    return Math.round(valor * 100) / 100;
}

export async function detectarCaidaRecaudoCiudad(
    ctx: ContextoDeteccion
): Promise<CandidatoAnomalia[]> {
    const { repo, parametros, ventanas } = ctx;
    const [pagosActual, pagosPrevia] = await Promise.all([
        repo.listarPagosAutorizadosPorSemana(
            ventanas.semanaActual.desde,
            ventanas.semanaActual.hasta
        ),
        repo.listarPagosAutorizadosPorSemana(
            ventanas.semanaAnterior.desde,
            ventanas.semanaAnterior.hasta
        ),
    ]);

    const porCiudad = new Map<string, { nombre: string; actual: number; anterior: number }>();
    const acumular = (pagos: typeof pagosActual, campo: "actual" | "anterior") => {
        for (const pago of pagos) {
            const colegio = pago.suscripcion.colegio;
            if (!colegio) continue; // titular PADRE: sin ciudad en v1
            const entrada = porCiudad.get(colegio.ciudadId) ?? {
                nombre: colegio.ciudad.nombre,
                actual: 0,
                anterior: 0,
            };
            entrada[campo] += pago.montoNetoUSD;
            porCiudad.set(colegio.ciudadId, entrada);
        }
    };
    acumular(pagosActual, "actual");
    acumular(pagosPrevia, "anterior");

    const candidatos: CandidatoAnomalia[] = [];
    for (const [ciudadId, sumas] of porCiudad) {
        const r = evaluarComparativaSemanal(
            redondear2(sumas.actual),
            redondear2(sumas.anterior),
            parametros.caidaRecaudoPctUmbral,
            parametros.baseMinimaComparacion,
            "CAIDA"
        );
        if (!r.evaluable || !r.dispara) continue;
        candidatos.push({
            tipo: "CAIDA_RECAUDO_CIUDAD",
            sujetoTipo: "Ciudad",
            sujetoId: ciudadId,
            severidad: "ALTA",
            descripcion: `El recaudo autorizado en ${sumas.nombre} cayó ${Math.abs(r.variacionPct ?? 0)}% respecto a la semana anterior.`,
            datosContexto: {
                ciudadId,
                ciudad: sumas.nombre,
                recaudoSemanaActualUSD: redondear2(sumas.actual),
                recaudoSemanaAnteriorUSD: redondear2(sumas.anterior),
                variacionPct: r.variacionPct,
                umbralPct: parametros.caidaRecaudoPctUmbral,
                ventanaInicio: ventanas.semanaActual.claveInicio,
                ventanaFin: ventanas.semanaActual.claveFin,
            },
        });
    }
    return candidatos;
}
