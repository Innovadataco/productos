/**
 * SPEC-225 (D-78): CANCELACIONES_MASIVAS_24H, severidad ALTA, anomalía GLOBAL
 * (sin sujeto individual: deduplica por `(tipo, null, null)`).
 * Más de `cancelaciones_24h_umbral` suscripciones canceladas en la ventana
 * móvil de las últimas 24 horas.
 */
import type { CandidatoAnomalia, ContextoDeteccion } from "../tipos";

export async function detectarCancelacionesMasivas24h(
    ctx: ContextoDeteccion
): Promise<CandidatoAnomalia[]> {
    const { repo, parametros, ventanas } = ctx;
    const total = await repo.contarCancelacionesDesde(ventanas.ultimas24h.desde);
    if (total <= parametros.cancelaciones24hUmbral) return [];
    return [
        {
            tipo: "CANCELACIONES_MASIVAS_24H",
            sujetoTipo: null,
            sujetoId: null,
            severidad: "ALTA",
            descripcion: `Se registraron ${total} cancelaciones de suscripción en las últimas 24 horas.`,
            datosContexto: {
                cancelaciones24h: total,
                umbral: parametros.cancelaciones24hUmbral,
                ventanaDesde: ventanas.ultimas24h.desde.toISOString(),
                ventanaHasta: ventanas.ultimas24h.hasta.toISOString(),
            },
        },
    ];
}
