import { detectarDoxing } from "./pii-patterns";
import { detectarKeywordsRiesgo } from "./keywords-riesgo";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

/**
 * Decisión pura de las guardas de seguridad (spec 123).
 *
 * Réplica EXACTA de la lógica de decisión de producción
 * (`src/app/api/reportes/procesar/helpers/guardas.ts` — `aplicarGuardasSeguridad`),
 * sin el side-effect `registrarPaso` (trazabilidad de expediente, solo tiene
 * sentido con un reporte persistido). Mismo orden de ramas y mismos
 * cortocircuitos `estadoFinal !== "POSIBLE_SPAM"`:
 *
 *   1. SPAM con confianza >= umbralSpam → POSIBLE_SPAM
 *   2. Doxing determinístico no reflejado por el modelo → REVISION_MANUAL
 *   3. Keywords críticas con OTRO/REVISION_MANUAL → prioridad alta (+ REVISION_MANUAL si era CLASIFICADO)
 *   4. Ráfaga → REVISION_MANUAL con prioridad alta
 *
 * La usan los contextos no productivos (sandbox, eval-runner) para decidir lo
 * mismo que el pipeline real. Producción NO la usa: sigue con su helper, que es
 * la referencia. La paridad está demostrada en `guardas-decision.test.ts`.
 */

export interface GuardasClasificacion {
    categoria: CategoriaConducta;
    confianza: number;
}

export interface GuardasDecision {
    estadoFinal: EstadoReporte;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
    reglasAplicadas: string[];
    doxing: { esDoxing: boolean; fragmentos: string[] };
    keywordsRiesgo: { tieneMatch: boolean; keywords: string[] };
}

export function decidirGuardasSeguridad({
    texto,
    clasificacion,
    estadoInicial,
    esRafaga,
    umbralSpam,
}: {
    texto: string;
    clasificacion: GuardasClasificacion;
    estadoInicial: EstadoReporte;
    esRafaga: boolean;
    umbralSpam: number;
}): GuardasDecision {
    let estadoFinal: EstadoReporte = estadoInicial;
    let prioridadAlta = false;
    let keywordsDetectadas: string[] = [];
    const reglasAplicadas: string[] = [];

    // Spec 026: SPAM con confianza suficiente pasa a revisión humana, no se autodestruye
    if (clasificacion.categoria === "SPAM" && clasificacion.confianza >= umbralSpam) {
        estadoFinal = "POSIBLE_SPAM";
        reglasAplicadas.push("spam_confianza_alta");
    }

    // Guarda de escalamiento DOXING (R3): la regla determinística nunca reclasifica,
    // solo fuerza revisión manual cuando hay señal de doxing que el LLM no reflejó.
    const doxing = detectarDoxing(texto);
    if (estadoFinal !== "POSIBLE_SPAM" && doxing.esDoxing && clasificacion.categoria !== "DOXING") {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
        keywordsDetectadas = doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"];
        reglasAplicadas.push("doxing_no_reflejado_por_modelo");
    }

    // F7: guarda de keywords críticas. Nunca reclasifica; fuerza revisión manual
    // cuando el modelo clasificó como OTRO pero hay señales de riesgo graves.
    const keywordsRiesgo = detectarKeywordsRiesgo(texto);
    if (
        estadoFinal !== "POSIBLE_SPAM" &&
        keywordsRiesgo.tieneMatch &&
        ((estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") || estadoFinal === "REVISION_MANUAL")
    ) {
        prioridadAlta = true;
        keywordsDetectadas = Array.from(new Set([...keywordsDetectadas, ...keywordsRiesgo.keywords]));
        reglasAplicadas.push("keywords_riesgo");
        if (estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") {
            estadoFinal = "REVISION_MANUAL";
        }
    }

    // F7: ráfaga fuerza revisión manual con prioridad alta
    if (estadoFinal !== "POSIBLE_SPAM" && esRafaga) {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
        reglasAplicadas.push("rafaga");
    }

    return { estadoFinal, prioridadAlta, keywordsDetectadas, reglasAplicadas, doxing, keywordsRiesgo };
}
