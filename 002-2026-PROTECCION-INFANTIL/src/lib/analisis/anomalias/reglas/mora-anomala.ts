/**
 * SPEC-225 (FR-005): PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL.
 * Suscripción ACTIVA/EN_GRACIA (cualquier `tipoTitular`) con `fechaFin`
 * vencida hace ≥ `mora_dias_umbral_media` días, SIN pago de renovación
 * autorizado posterior a `fechaFin`, y con ≥2 pagos autorizados puntuales
 * ("históricamente puntual", definición operacional H-6 en puntualidad.ts).
 * Severidad: MEDIA al umbral medio, ALTA a partir de `mora_dias_umbral_alta`.
 */
import type { CandidatoAnomalia, ContextoDeteccion } from "../tipos";
import { contarPagosPuntuales } from "../puntualidad";

const DIA_MS = 24 * 60 * 60 * 1000;

export async function detectarMoraAnomala(ctx: ContextoDeteccion): Promise<CandidatoAnomalia[]> {
    const { repo, parametros, ahora } = ctx;
    const limiteVencimiento = new Date(
        ahora.getTime() - parametros.moraDiasUmbralMedia * DIA_MS
    );
    const suscripciones = await repo.listarSuscripcionesVencidasConPagos(limiteVencimiento);

    const candidatos: CandidatoAnomalia[] = [];
    for (const s of suscripciones) {
        // Si ya existe una renovación AUTORIZADA posterior al vencimiento, no hay mora.
        const renovo = s.pagos.some(
            (p) => p.fechaAutorizacion !== null && p.fechaAutorizacion.getTime() > s.fechaFin.getTime()
        );
        if (renovo) continue;

        const pagosPuntuales = contarPagosPuntuales(s.fechaInicio, s.pagos);
        if (pagosPuntuales < 2) continue;

        const diasMora = Math.floor((ahora.getTime() - s.fechaFin.getTime()) / DIA_MS);
        const severidad = diasMora >= parametros.moraDiasUmbralAlta ? "ALTA" : "MEDIA";
        const titular = s.tipoTitular === "COLEGIO" ? "colegio" : "padre";

        candidatos.push({
            tipo: "PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL",
            sujetoTipo: "Suscripcion",
            sujetoId: s.id,
            severidad,
            descripcion: `Suscripción de ${titular} históricamente puntual acumula ${diasMora} días de mora sin renovación autorizada.`,
            datosContexto: {
                suscripcionId: s.id,
                tipoTitular: s.tipoTitular,
                colegioId: s.colegioId,
                diasMora,
                pagosPuntuales,
                pagosAutorizados: s.pagos.length,
                fechaFin: s.fechaFin.toISOString(),
                umbralMediaDias: parametros.moraDiasUmbralMedia,
                umbralAltaDias: parametros.moraDiasUmbralAlta,
            },
        });
    }
    return candidatos;
}
