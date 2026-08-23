/**
 * SPEC-234 (002-PI-134): cálculo de score de gravedad de un expediente.
 * Fórmula parametrizada 100% determinista; no utiliza IA.
 */
import type { ResultadoRegla } from "../reglas/aceleracion";

export interface ScoreInput {
    numEventos: number;
    eventosCategoriaGrave: number;
    patrones: ResultadoRegla[];
    senalComunitariaScore: number;
    pesoNumReportes: number;
    pesoCategoriaGrave: number;
    pesoAceleracion: number;
    pesoSenalComunitaria: number;
    umbralAmarillo: number;
    umbralRojo: number;
}

export interface ScoreResultado {
    score: number;
    gravedad: "VERDE" | "AMARILLO" | "ROJO";
}

export function calcularScore(input: ScoreInput): ScoreResultado {
    const patronScore = input.patrones.reduce((sum, patron) => {
        if (!patron.detectado) return sum;
        const factor = patron.severidad === "ALTA" ? 2 : 1;
        return sum + input.pesoAceleracion * factor;
    }, 0);

    const score =
        input.numEventos * input.pesoNumReportes +
        input.eventosCategoriaGrave * input.pesoCategoriaGrave +
        patronScore +
        input.senalComunitariaScore * input.pesoSenalComunitaria;

    const gravedad: ScoreResultado["gravedad"] =
        score >= input.umbralRojo ? "ROJO" : score >= input.umbralAmarillo ? "AMARILLO" : "VERDE";

    return { score, gravedad };
}
