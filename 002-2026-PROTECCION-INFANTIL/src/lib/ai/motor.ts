/**
 * SPEC-138 (E-7): selector UNIFICADO del motor de clasificación.
 * A partir de la Fase 3 de 002-PI-068 el único motor activo es la RÚBRICA.
 * `clasificarConMotorActivo` delega siempre en `clasificarConRubrica` y adapta
 * el resultado a la forma `ResultadoMotor` que esperan el pipeline y el sandbox.
 */
import { cargarConfigRubrica, clasificarConRubrica, type ConfigRubrica, type ResultadoRubrica } from "./rubrica";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

/** Forma unificada del resultado del motor de clasificación. */
export interface ResultadoMotor {
    categoria: CategoriaConducta;
    confianza: number;
    categoriasSecundarias: unknown[];
    posibleAgresorPar: boolean;
    estado: EstadoReporte;
    metrics: {
        modelo: string;
        latenciaMs: number;
        promptTokens?: number | null | undefined;
        responseTokens?: number | null | undefined;
    };
    rawResponse: unknown;
    votos: unknown[];
    fallback: boolean;
    /** Resultado completo de la rúbrica (matriz de votos por modelo). */
    rubrica?: ResultadoRubrica | undefined;
}

export interface OpcionesMotor {
    /** Overrides puntuales de la config de la rúbrica (sandbox/eval). */
    configRubrica?: Partial<ConfigRubrica> | undefined;
}

/**
 * Lee la señal posibleAgresorPar del resultado de la rúbrica si existe.
 * NEEDS CLARIFICATION (SPEC-138 FASE 2, radicada a ZEUS): la rúbrica aún NO
 * produce el campo — la estructura de respuestas (preguntas cumplidas, sin
 * negaciones explícitas) no permite derivar "agresor no adulto" de forma fiable
 * y conservadora (§1.3). Mientras tanto: tolerante, devuelve false.
 */
export function leerPosibleAgresorPar(r: ResultadoRubrica | undefined): boolean {
    if (!r) return false;
    return "posibleAgresorPar" in r && typeof r.posibleAgresorPar === "boolean" ? r.posibleAgresorPar : false;
}

/**
 * Clasifica con el motor activo (ahora siempre la rúbrica).
 * La decisión de conducta (categoría/estado) la toma `clasificarConRubrica`;
 * esta función solo adapta el resultado a la forma común del pipeline.
 */
export async function clasificarConMotorActivo(texto: string, opciones: OpcionesMotor = {}): Promise<ResultadoMotor> {
    const r = await clasificarConRubrica(texto, opciones.configRubrica);
    return {
        categoria: r.categoria,
        confianza: r.confianza,
        categoriasSecundarias: r.categoriasSecundarias,
        posibleAgresorPar: leerPosibleAgresorPar(r),
        estado: r.estado,
        metrics: {
            modelo: r.metrics.modelo,
            latenciaMs: r.metrics.latenciaMs,
            promptTokens: r.metrics.promptTokens,
            responseTokens: r.metrics.responseTokens,
        },
        rawResponse: r.rawResponse,
        votos: r.votosModelos,
        fallback: r.fallback,
        rubrica: r,
    };
}
