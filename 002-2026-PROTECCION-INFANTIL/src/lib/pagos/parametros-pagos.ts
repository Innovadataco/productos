/**
 * SPEC-211 (002-PI-111): lectura de parámetros del módulo de pagos que consumen
 * las vistas de cliente y la renovación. Centraliza defaults defensivos para
 * que la vista funcione aunque el seed aún no se haya corrido.
 */
import type { TipoTitular } from "@prisma/client";
import { getParametroSistemaValor } from "@/lib/parametros";

const DEFAULT_TAMANO_MAX_MB = 10;
const DEFAULT_FORMATOS = "image/png,image/jpeg,application/pdf";

function parseEnteroPositivo(valor: string | null, fallback: number): number {
    if (!valor) return fallback;
    const n = parseInt(valor, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseFloatNoNegativo(valor: string | null, fallback: number): number {
    if (!valor) return fallback;
    const n = parseFloat(valor);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Límites del comprobante de pago (tamaño MB + formatos MIME permitidos). */
export async function obtenerLimitesComprobante(): Promise<{ tamanoMaxMB: number; formatosPermitidos: string[] }> {
    const [tamano, formatos] = await Promise.all([
        getParametroSistemaValor("pagos.comprobante_tamaño_max_mb"),
        getParametroSistemaValor("pagos.comprobante_formatos_permitidos"),
    ]);
    const lista = (formatos ?? DEFAULT_FORMATOS)
        .split(",")
        .map((f) => f.trim().toLowerCase())
        .filter(Boolean);
    return {
        tamanoMaxMB: parseEnteroPositivo(tamano, DEFAULT_TAMANO_MAX_MB),
        formatosPermitidos: lista.length > 0 ? lista : DEFAULT_FORMATOS.split(","),
    };
}

/** % de descuento anual por defecto cuando el Plan no trae override. */
export async function obtenerDescuentoAnualDefaultPct(): Promise<number> {
    return parseFloatNoNegativo(await getParametroSistemaValor("pagos.descuento_anual_pct_default"), 15);
}

/**
 * % de descuento por código de referido. El seed del parámetro
 * `pagos.referidos.descuento_referido_pct` pertenece a SPEC-215; si aún no
 * existe, el descuento es 0 (el código igualmente queda registrado en el pago).
 */
export async function obtenerDescuentoReferidoPct(): Promise<number> {
    return parseFloatNoNegativo(await getParametroSistemaValor("pagos.referidos.descuento_referido_pct"), 0);
}

/** Si el contrato firmado es obligatorio para el tipo de titular (bloque 6 de la vista). */
export async function esContratoObligatorio(tipoTitular: TipoTitular): Promise<boolean> {
    const clave = tipoTitular === "COLEGIO" ? "pagos.contrato_obligatorio_colegios" : "pagos.contrato_obligatorio_padres";
    const valor = await getParametroSistemaValor(clave);
    // Colegios: obligatorio por defecto (BRIEF); padres: opcional por defecto.
    const fallback = tipoTitular === "COLEGIO" ? "true" : "false";
    return (valor ?? fallback).trim().toLowerCase() === "true";
}
