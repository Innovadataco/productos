/**
 * SPEC-194 (002-PI-088): lectura de parámetros de analítica de colegios.
 * Si un parámetro falta, se usa el default y se loguea (nunca se rompe).
 */

import { getParametroSistemaValor } from "@/lib/parametros";
import type { ParametroClient } from "@/lib/parametros";

export interface ParametrosAnalyticsColegios {
    cacheTtlMin: number;
    inactividadAlertaDias: number;
    spamAlertaPct: number;
    resolucionComiteOkPct: number;
    periodoDefaultDias: number;
    // SPEC-303 (002-PI-209): 3 umbrales adicionales del semáforo · reutilizan namespace.
    casosAbiertosAlto: number;
    casosSinMovimientoDias: number;
    porcentajeProcesadoMin: number;
}

function parseNumero(valor: string | null, defaultValue: number): number {
    if (valor === null) return defaultValue;
    const n = Number(valor);
    return Number.isFinite(n) ? n : defaultValue;
}

export async function cargarParametrosAnalytics(client?: ParametroClient): Promise<ParametrosAnalyticsColegios> {
    const [
        cacheTtlMin,
        inactividadAlertaDias,
        spamAlertaPct,
        resolucionComiteOkPct,
        periodoDefaultDias,
        casosAbiertosAlto,
        casosSinMovimientoDias,
        porcentajeProcesadoMin,
    ] = await Promise.all([
        getParametroSistemaValor("analytics.colegios.cache_ttl_min", client),
        getParametroSistemaValor("analytics.colegios.inactividad_alerta_dias", client),
        getParametroSistemaValor("analytics.colegios.spam_alerta_pct", client),
        getParametroSistemaValor("analytics.colegios.resolucion_comite_ok_pct", client),
        getParametroSistemaValor("analytics.colegios.periodo_default_dias", client),
        getParametroSistemaValor("analytics.colegios.casos_abiertos_alto", client),
        getParametroSistemaValor("analytics.colegios.casos_sin_movimiento_dias", client),
        getParametroSistemaValor("analytics.colegios.porcentaje_procesado_min", client),
    ]);

    return {
        cacheTtlMin: parseNumero(cacheTtlMin, 5),
        inactividadAlertaDias: parseNumero(inactividadAlertaDias, 45),
        spamAlertaPct: parseNumero(spamAlertaPct, 0.5),
        resolucionComiteOkPct: parseNumero(resolucionComiteOkPct, 0.8),
        periodoDefaultDias: parseNumero(periodoDefaultDias, 30),
        casosAbiertosAlto: parseNumero(casosAbiertosAlto, 5),
        casosSinMovimientoDias: parseNumero(casosSinMovimientoDias, 14),
        porcentajeProcesadoMin: parseNumero(porcentajeProcesadoMin, 0.7),
    };
}
