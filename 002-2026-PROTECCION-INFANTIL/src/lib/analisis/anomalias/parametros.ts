/**
 * SPEC-225 (002-PI-126): lectura tipada de los umbrales `analisis.anomalias.*`
 * de `ParametroSistema`. Se releen FRESCOS en cada tick del worker (FR-004:
 * tuning sin redeploy). Los defaults coinciden con el seed (`prisma/seed.ts`,
 * bloque SPEC-225 + los 3 de SPEC-220).
 */
import { getParametroSistemaValor } from "@/lib/parametros";
import type { ParametrosAnomalias } from "./tipos";

export const PARAMETROS_ANOMALIAS_DEFAULT: ParametrosAnomalias = {
    tickMin: 60,
    moraDiasUmbralMedia: 15,
    moraDiasUmbralAlta: 30,
    crecimientoPctUmbral: 25,
    usoCaidoPctUmbral: 50,
    caidaRecaudoPctUmbral: 30,
    cancelaciones24hUmbral: 5,
    colegioGrandeMinReportes: 50,
    baseMinimaComparacion: 3,
    emailInmediatoHabilitado: true,
};

async function leerNumero(clave: string, defecto: number): Promise<number> {
    const valor = await getParametroSistemaValor(clave);
    if (valor === null) return defecto;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : defecto;
}

async function leerBooleano(clave: string, defecto: boolean): Promise<boolean> {
    const valor = await getParametroSistemaValor(clave);
    if (valor === null) return defecto;
    return valor === "true";
}

/** Lee los 10 umbrales del detector; ante valor ausente/inválido usa el default. */
export async function leerParametrosAnomalias(): Promise<ParametrosAnomalias> {
    const d = PARAMETROS_ANOMALIAS_DEFAULT;
    const [
        tickMin,
        moraDiasUmbralMedia,
        moraDiasUmbralAlta,
        crecimientoPctUmbral,
        usoCaidoPctUmbral,
        caidaRecaudoPctUmbral,
        cancelaciones24hUmbral,
        colegioGrandeMinReportes,
        baseMinimaComparacion,
        emailInmediatoHabilitado,
    ] = await Promise.all([
        leerNumero("analisis.anomalias.tick_min", d.tickMin),
        leerNumero("analisis.anomalias.mora_dias_umbral_media", d.moraDiasUmbralMedia),
        leerNumero("analisis.anomalias.mora_dias_umbral_alta", d.moraDiasUmbralAlta),
        leerNumero("analisis.anomalias.crecimiento_pct_umbral", d.crecimientoPctUmbral),
        leerNumero("analisis.anomalias.uso_caido_pct_umbral", d.usoCaidoPctUmbral),
        leerNumero("analisis.anomalias.caida_recaudo_pct_umbral", d.caidaRecaudoPctUmbral),
        leerNumero("analisis.anomalias.cancelaciones_24h_umbral", d.cancelaciones24hUmbral),
        leerNumero("analisis.anomalias.colegio_grande_min_reportes", d.colegioGrandeMinReportes),
        leerNumero("analisis.anomalias.base_minima_comparacion", d.baseMinimaComparacion),
        leerBooleano("analisis.anomalias.email_inmediato_habilitado", d.emailInmediatoHabilitado),
    ]);
    return {
        tickMin,
        moraDiasUmbralMedia,
        moraDiasUmbralAlta,
        crecimientoPctUmbral,
        usoCaidoPctUmbral,
        caidaRecaudoPctUmbral,
        cancelaciones24hUmbral,
        colegioGrandeMinReportes,
        baseMinimaComparacion,
        emailInmediatoHabilitado,
    };
}

/** Cadencia del worker en minutos (releída por el loop en cada ciclo). */
export async function obtenerTickMinAnomalias(): Promise<number> {
    return leerNumero("analisis.anomalias.tick_min", PARAMETROS_ANOMALIAS_DEFAULT.tickMin);
}
