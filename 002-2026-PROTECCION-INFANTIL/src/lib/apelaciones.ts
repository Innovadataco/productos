import { randomBytes } from "crypto";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "./prisma";
import { idsReportesNoReales } from "./dal/demo-exclusion";
import { getParametroSistemaValor, type ParametroClient } from "./parametros";
import {
    esDiaHabilColombia,
    sumarDiasHabilesColombia,
    diasHabilesTranscurridosColombia,
} from "./fechas/dias-habiles-colombia";
import type { EstadoApelacion } from "@prisma/client";

/**
 * SPEC-110 — Dominio de la apelación del identificador reportado.
 *
 * Reglas duras del diseño cerrado (CEO):
 * - Apelar NO cambia la visibilidad; solo la resolución del comité.
 * - El apelante NO ve contenido de reportes: solo el número N de reportes asociados.
 *
 * Días hábiles: SPEC-768 los unificó en `fechas/dias-habiles-colombia` (calendario
 * de Bogotá + festivos Colombia). Antes este archivo los calculaba lunes-viernes
 * SIN festivos y con un bug de tipos (medianoche UTC + getDay ciego a zona) que
 * podía vencer TARDE. Ahora estos exports DELEGAN al módulo corregido.
 */

export const APELACION_DEFAULTS = {
    plazoRespuestaDiasHabiles: 15,
    avisoPrevioDias: 10,
    retencionDocumentoDias: 30,
    maxTamanoDocumentoMb: 5,
} as const;

const ESTADOS_ABIERTOS: EstadoApelacion[] = ["RECIBIDA", "EN_REVISION"];

async function getParamEntero(clave: string, fallback: number, client?: ParametroClient): Promise<number> {
    const valor = await getParametroSistemaValor(clave, client);
    const n = parseInt(valor ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getPlazoRespuestaDiasHabiles(client?: ParametroClient): Promise<number> {
    return getParamEntero("apelacion.plazo_respuesta_dias_habiles", APELACION_DEFAULTS.plazoRespuestaDiasHabiles, client);
}

export function getAvisoPrevioDias(client?: ParametroClient): Promise<number> {
    return getParamEntero("apelacion.aviso_previo_dias", APELACION_DEFAULTS.avisoPrevioDias, client);
}

export function getRetencionDocumentoDias(client?: ParametroClient): Promise<number> {
    return getParamEntero("apelacion.retencion_documento_dias", APELACION_DEFAULTS.retencionDocumentoDias, client);
}

export function getMaxTamanoDocumentoMb(client?: ParametroClient): Promise<number> {
    return getParamEntero("apelacion.max_tamano_documento_mb", APELACION_DEFAULTS.maxTamanoDocumentoMb, client);
}

const TZ = "America/Bogota";

// SPEC-768: DELEGACIÓN — misma firma, conducta corregida. El cálculo real (y su
// candado) viven en `fechas/dias-habiles-colombia`. Nada de `getDay`/`Date.UTC`
// crudo acá: eso reintroduciría el bug de tipos en el sitio de lectura.
export function esDiaHabil(fecha: Date): boolean {
    return esDiaHabilColombia(fecha);
}

/** Suma N días hábiles a una fecha (el día del ancla no cuenta). Ver SPEC-768. */
export function sumarDiasHabiles(fecha: Date, dias: number): Date {
    return sumarDiasHabilesColombia(fecha, dias);
}

/**
 * Días hábiles transcurridos entre `desde` (excluido) y `hasta` (incluido).
 * 0 si `hasta` es el mismo día o anterior. Ver SPEC-768.
 */
export function diasHabilesTranscurridos(desde: Date, hasta: Date): number {
    return diasHabilesTranscurridosColombia(desde, hasta);
}

export async function calcularPlazoRespuesta(desde: Date, client?: ParametroClient): Promise<Date> {
    const dias = await getPlazoRespuestaDiasHabiles(client);
    return sumarDiasHabiles(desde, dias);
}

export function generarNumeroApelacion(ahora: Date = new Date()): string {
    const year = formatInTimeZone(ahora, TZ, "yyyy");
    const sufijo = randomBytes(3).toString("hex").toUpperCase();
    return `APL-${year}-${sufijo}`;
}

/**
 * ÚNICO dato de reportes que puede ver el apelante: cuántos existen (no eliminados)
 * para el identificador + plataforma declarados. Nunca texto, fechas ni plataforma.
 */
export async function contarReportesAsociados(
    identificador: string,
    plataformaId: string,
    client?: ParametroClient
): Promise<number> {
    const db = client ?? prisma;
    // SPEC-863 (I-400): el conteo que ve el APELANTE (titular) no incluye reportes de prueba.
    return db.reporte.count({
        where: { identificador, plataformaId, eliminado: false, id: { notIn: await idsReportesNoReales(db) } },
    });
}

/**
 * Indica si una apelación abierta ya superó el umbral de aviso previo al comité
 * (N días hábiles desde el radicado sin resolverse).
 */
export function estaEnAvisoPrevio(
    apelacion: { estado: EstadoApelacion; creadoEn: Date },
    diasAviso: number,
    ahora: Date = new Date()
): boolean {
    if (!ESTADOS_ABIERTOS.includes(apelacion.estado)) return false;
    return diasHabilesTranscurridos(apelacion.creadoEn, ahora) >= diasAviso;
}

export function esApelacionAbierta(estado: EstadoApelacion): boolean {
    return ESTADOS_ABIERTOS.includes(estado);
}
