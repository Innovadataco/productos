/**
 * SPEC-138 (E-7): selector UNIFICADO del motor de clasificación.
 * El MISMO switch que producción: `ia.rubrica.enabled` (parámetro en BD) decide
 * rúbrica vs legacy (default seguro: legacy, D-19 spec 095). Lo usan los TRES
 * contextos: pipeline de procesamiento (reporte-processing), sandbox y
 * eval-runner — el laboratorio ejercita el motor que corre en prod.
 *
 * Overrides por contexto: `voting`/`modeloClasificacionLegacy` aplican SOLO al
 * motor legacy (como hoy); la rúbrica usa su propia config por parámetros
 * (`ia.rubrica.*`), igual que en producción. `configRubrica` permite overrides
 * puntuales de la rúbrica si un contexto los necesita.
 */
import { clasificarConVotos, type VotingConfig } from "./classifier";
import { cargarConfigRubrica, clasificarConRubrica, type ConfigRubrica, type ResultadoRubrica } from "./rubrica";
import { MODELO_CLASIFICACION_DEFAULT } from "./defaults";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

export type MotorClasificacion = "rubrica" | "legacy";

/** Forma unificada del resultado (compatible con ambos motores). */
export interface ResultadoMotor {
    motor: MotorClasificacion;
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
    /** Solo legacy con cascada. */
    usoCascada?: boolean | undefined;
    /** Solo legacy con cascada. */
    modeloCascada?: string | undefined;
    /** Resultado completo de la rúbrica (matriz de votos, solo motor rúbrica). */
    rubrica?: ResultadoRubrica | undefined;
}

export interface OpcionesMotor {
    /** Modelo del motor legacy (override del contexto; default: MODELO_CLASIFICACION_DEFAULT). */
    modeloClasificacionLegacy?: string | undefined;
    /** Overrides de votación del motor legacy (sandbox/eval/pipeline). */
    voting?: Partial<VotingConfig> | undefined;
    /** Overrides puntuales de la config de la rúbrica (hoy ningún contexto los usa). */
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

/** Solo lectura del switch (sin ejecutar el motor): para registrar `motorUsado`. */
export async function motorActivo(): Promise<MotorClasificacion> {
    const config = await cargarConfigRubrica();
    return config.enabled ? "rubrica" : "legacy";
}

/**
 * Clasifica con el motor activo (mismo switch que producción).
 * La decisión de conducta (categoría/estado) es idéntica a la de cada motor por
 * su camino actual; esta función solo UNIFICA quién elige la rama.
 */
export async function clasificarConMotorActivo(texto: string, opciones: OpcionesMotor = {}): Promise<ResultadoMotor> {
    const configRubrica = await cargarConfigRubrica();

    if (configRubrica.enabled) {
        const r = await clasificarConRubrica(texto, opciones.configRubrica);
        return {
            motor: "rubrica",
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
            usoCascada: false,
            modeloCascada: undefined,
            rubrica: r,
        };
    }

    const r = await clasificarConVotos(
        opciones.modeloClasificacionLegacy ?? MODELO_CLASIFICACION_DEFAULT,
        texto,
        opciones.voting
    );
    return {
        motor: "legacy",
        categoria: r.categoria,
        confianza: r.confianza,
        categoriasSecundarias: r.categoriasSecundarias,
        posibleAgresorPar: r.posibleAgresorPar,
        estado: r.estado,
        metrics: {
            modelo: r.metrics.modelo,
            latenciaMs: r.metrics.latenciaMs,
            promptTokens: r.metrics.promptTokens,
            responseTokens: r.metrics.responseTokens,
        },
        rawResponse: r.rawResponse,
        votos: r.votos,
        fallback: r.fallback,
        usoCascada: r.usoCascada,
        modeloCascada: r.modeloCascada,
        rubrica: undefined,
    };
}
