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

/**
 * SPEC-215 (002-PI-115): tope anual de referidos exitosos por código
 * (`pagos.referidos.max_por_año`). Default 5 (BRIEF §5.1).
 */
export async function obtenerMaxReferidosPorAnio(): Promise<number> {
    return parseEnteroPositivo(await getParametroSistemaValor("pagos.referidos.max_por_año"), 5);
}

/**
 * SPEC-215 (002-PI-115): umbral de usos activados del año a partir del cual se
 * marca el uso para revisión de admin y se emite `referido.tope_anual`
 * (`pagos.referidos.notificar_admin_al`). Default 4.
 */
export async function obtenerReferidosNotificarAdminAl(): Promise<number> {
    return parseEnteroPositivo(await getParametroSistemaValor("pagos.referidos.notificar_admin_al"), 4);
}

/** Si el contrato firmado es obligatorio para el tipo de titular (bloque 6 de la vista). */
export async function esContratoObligatorio(tipoTitular: TipoTitular): Promise<boolean> {
    const clave = tipoTitular === "COLEGIO" ? "pagos.contrato_obligatorio_colegios" : "pagos.contrato_obligatorio_padres";
    const valor = await getParametroSistemaValor(clave);
    // Colegios: obligatorio por defecto (BRIEF); padres: opcional por defecto.
    const fallback = tipoTitular === "COLEGIO" ? "true" : "false";
    return (valor ?? fallback).trim().toLowerCase() === "true";
}

/**
 * SPEC-218 (002-PI-118): TTL de la caché en memoria por widget de la analítica
 * dinero-vs-valor (`pagos.analitica.cache_segundos`). Default 60 s (FR-006).
 */
export async function obtenerCacheAnaliticaSegundos(): Promise<number> {
    return parseEnteroPositivo(await getParametroSistemaValor("pagos.analitica.cache_segundos"), 60);
}

// SPEC-217 (002-PI-117): parámetros del freemium (seed de SPEC-210; defaults
// defensivos idénticos para que el alta funcione aunque el seed no haya corrido).

/** Si el freemium está activo para nuevos clientes (`pagos.freemium.activo`). Default true. */
export async function esFreemiumActivo(): Promise<boolean> {
    const valor = await getParametroSistemaValor("pagos.freemium.activo");
    return (valor ?? "true").trim().toLowerCase() === "true";
}

/** Días de duración del freemium (`pagos.freemium.duracion_dias`). Default 30. */
export async function obtenerDuracionFreemiumDias(): Promise<number> {
    return parseEnteroPositivo(await getParametroSistemaValor("pagos.freemium.duracion_dias"), 30);
}

// SPEC-244 (002-PI-147): parámetros de IVA para el selector de planes.

/** % de IVA aplicado a planes pagos (`pagos.iva.porcentaje`). Default 19. */
export async function obtenerTasaIva(): Promise<number> {
    return parseFloatNoNegativo(await getParametroSistemaValor("pagos.iva.porcentaje"), 19);
}

/** Determina si el IVA aplica a un tipo de titular según `pagos.iva.aplica_a`. Default true. */
export function ivaAplicaATitular(aplicaA: string | null | undefined, tipoTitular: TipoTitular): boolean {
    const valor = (aplicaA ?? "todos").trim().toLowerCase();
    if (valor === "todos") return true;
    if (valor === "ninguno") return false;
    if (valor === "solo_colegios") return tipoTitular === "COLEGIO";
    if (valor === "solo_padres") return tipoTitular === "PADRE";
    return true;
}

/** Resuelve si el IVA aplica al tipo de titular leyendo el parámetro del sistema. */
export async function ivaAplicaA(tipoTitular: TipoTitular): Promise<boolean> {
    const aplicaA = await getParametroSistemaValor("pagos.iva.aplica_a");
    return ivaAplicaATitular(aplicaA, tipoTitular);
}
