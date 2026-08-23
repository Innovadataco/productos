/**
 * SPEC-214 (002-PI-114): servicio de tasas de cambio.
 * Origen base: USD. Monedas destino configurables vía ParametroSistema.
 */
import { FuenteTasa } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getParametroSistemaValor } from "@/lib/parametros";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";

const MONEDA_BASE = "USD";
const DEFAULT_API_URL = "https://api.exchangerate.host/v1/latest?base=USD&symbols=";
const DEFAULT_MONEDAS_DESTINO = ["COP", "MXN", "CLP", "ARS"];

interface TasasAPIResponse {
    success?: boolean;
    rates?: Record<string, number>;
    // exchangerate.host v1 usa estos campos
    base?: string;
    date?: string;
    // exchangerate.host gratis legacy
    conversion_rates?: Record<string, number>;
}

function parseApiResponse(text: string): TasasAPIResponse {
    try {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== "object") {
            throw new AppError("Respuesta de API de tasas inválida", ERROR_CODES.SERVICE_UNAVAILABLE, 503);
        }
        return parsed as TasasAPIResponse;
    } catch {
        throw new AppError("Respuesta de API de tasas inválida", ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    }
}

function extraerRates(data: TasasAPIResponse): Record<string, number> {
    if (data.rates && typeof data.rates === "object") return data.rates;
    if (data.conversion_rates && typeof data.conversion_rates === "object") return data.conversion_rates;
    throw new AppError("Respuesta de API de tasas sin rates", ERROR_CODES.SERVICE_UNAVAILABLE, 503);
}

async function fetchConTimeout(url: string, timeoutMs: number, intento: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (error) {
        clearTimeout(timer);
        if (intento > 0) {
            await new Promise((r) => setTimeout(r, 500));
            return fetchConTimeout(url, timeoutMs, intento - 1);
        }
        throw error;
    }
}

/**
 * Calcula el monto local para un precio neto en USD usando la tasa más reciente.
 * Retorna null si no hay tasa para la moneda destino.
 */
export async function calcularMontoLocal(
    precioNetoUSD: number,
    monedaDestino: string
): Promise<{ montoLocal: number; tasaAplicada: number; desactualizada: boolean } | null> {
    const repo = new PagosRepository();
    const tasa = await repo.obtenerTasaCambioMasReciente(monedaDestino);
    if (!tasa) return null;

    const horasDesdeActualizacion = Math.max(0, Math.floor((Date.now() - tasa.fecha.getTime()) / (1000 * 60 * 60)));
    return {
        montoLocal: Math.round(precioNetoUSD * tasa.tasa * 100) / 100,
        tasaAplicada: tasa.tasa,
        desactualizada: horasDesdeActualizacion > 24,
    };
}

/**
 * Actualiza las tasas de cambio desde la API pública configurada.
 * Retorna { ok, insertadas, errores, apiUrl }.
 */
export async function actualizarTasasDesdeAPI(): Promise<{ ok: boolean; insertadas: number; errores: string[]; apiUrl: string }> {
    const [apiUrlParam, monedasParam] = await Promise.all([
        getParametroSistemaValor("pagos.tasas.api_url_default"),
        getParametroSistemaValor("pagos.tasas.monedas_destino"),
    ]);

    const monedasDestino = monedasParam?.split(",").map((m) => m.trim().toUpperCase()).filter(Boolean) ?? DEFAULT_MONEDAS_DESTINO;
    const apiUrlBase = apiUrlParam ?? DEFAULT_API_URL;
    const apiUrl = apiUrlBase.includes("?") ? `${apiUrlBase}${apiUrlBase.endsWith("?") ? "" : "&"}${monedasDestino.join(",")}` : `${apiUrlBase}${monedasDestino.join(",")}`;

    const repo = new PagosRepository();
    const errores: string[] = [];
    let insertadas = 0;

    try {
        const res = await fetchConTimeout(apiUrl, 5000, 1);
        if (!res.ok) {
            throw new AppError(`API de tasas respondió HTTP ${res.status}`, ERROR_CODES.SERVICE_UNAVAILABLE, 503);
        }

        const data = parseApiResponse(await res.text());
        const rates = extraerRates(data);
        const fecha = new Date();

        for (const moneda of monedasDestino) {
            const tasa = rates[moneda];
            if (typeof tasa !== "number" || !Number.isFinite(tasa) || tasa <= 0) {
                errores.push(`Moneda ${moneda}: tasa no disponible o inválida`);
                continue;
            }
            await repo.crearTasaCambio({
                monedaOrigen: MONEDA_BASE,
                monedaDestino: moneda,
                tasa,
                fecha,
                fuente: FuenteTasa.API,
                apiUrl,
            });
            insertadas++;
        }

        return { ok: insertadas > 0, insertadas, errores, apiUrl };
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido consultando tasas";
        throw new AppError(msg, ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    }
}
