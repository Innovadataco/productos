import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { getParametroSistemaValor, type ParametroClient } from "./parametros";
import type { EstadoApelacion } from "@prisma/client";

/**
 * SPEC-110 — Dominio de la apelación del identificador reportado.
 *
 * Reglas duras del diseño cerrado (CEO):
 * - Apelar NO cambia la visibilidad; solo la resolución del comité.
 * - El apelante NO ve contenido de reportes: solo el número N de reportes asociados.
 *
 * Días hábiles = lunes a viernes (sin calendario de festivos; ver spec.md Assumptions).
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

function inicioDeDia(fecha: Date): Date {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function esDiaHabil(fecha: Date): boolean {
    const dia = fecha.getDay();
    return dia >= 1 && dia <= 5;
}

/**
 * Suma N días hábiles a una fecha (la fecha de inicio no cuenta; se cuentan los
 * días hábiles siguientes). Conserva la hora de la fecha de inicio.
 */
export function sumarDiasHabiles(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    let restantes = dias;
    while (restantes > 0) {
        resultado.setDate(resultado.getDate() + 1);
        if (esDiaHabil(resultado)) restantes--;
    }
    return resultado;
}

/**
 * Días hábiles transcurridos entre `desde` (excluido) y `hasta` (incluido).
 * 0 si `hasta` es el mismo día o anterior.
 */
export function diasHabilesTranscurridos(desde: Date, hasta: Date): number {
    const cursor = inicioDeDia(desde);
    const fin = inicioDeDia(hasta);
    let count = 0;
    while (cursor < fin) {
        cursor.setDate(cursor.getDate() + 1);
        if (esDiaHabil(cursor)) count++;
    }
    return count;
}

export async function calcularPlazoRespuesta(desde: Date, client?: ParametroClient): Promise<Date> {
    const dias = await getPlazoRespuestaDiasHabiles(client);
    return sumarDiasHabiles(desde, dias);
}

export function generarNumeroApelacion(): string {
    const year = new Date().getFullYear();
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
    return db.reporte.count({
        where: { identificador, plataformaId, eliminado: false },
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
